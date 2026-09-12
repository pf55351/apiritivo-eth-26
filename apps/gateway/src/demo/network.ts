import { randomUUID } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { type Hex, verifyMessage } from "viem";
import {
  AppError,
  canonical,
  listingFromManifest,
  manifestMessage,
  namedId,
  purchaseId,
  signedManifestSchema,
  type Activation,
  type Entitlement,
  type Intent,
  type Listing,
  type Manifest,
  type Payment,
  type Plan,
  type SignedTransaction,
} from "../../../../packages/domain/src/index.ts";
import type {
  ArkivPort,
  MarketPort,
  SwarmPort,
} from "../../../../packages/domain/src/ports.ts";
import { contentReference } from "../../../../packages/swarm/src/reference.ts";
import { sampleManifests } from "../../../../scripts/sample-manifests.ts";
import type { Store } from "../db/store.ts";

// Explicit local rehearsal only. This adapter never sends a blockchain transaction.
export const DEMO_KEY = `0x${"12".repeat(32)}` as Hex;
export class DemoNetwork implements ArkivPort, MarketPort, SwarmPort {
  address = namedId("demo-market").slice(0, 42) as Hex;
  issuer = privateKeyToAccount(DEMO_KEY).address.toLowerCase() as Hex;
  constructor(private store: Store) {
    store.db.exec(
      "CREATE TABLE IF NOT EXISTS demo_records (kind TEXT, id TEXT, document TEXT NOT NULL, PRIMARY KEY(kind, id))",
    );
  }
  private read<T>(kind: string, id: string): T | undefined {
    const row = this.store.db
      .prepare("SELECT document FROM demo_records WHERE kind = ? AND id = ?")
      .get(kind, id);
    return row ? JSON.parse(row.document as string) : undefined;
  }
  private write(kind: string, id: string, value: unknown) {
    this.store.db
      .prepare("INSERT OR REPLACE INTO demo_records VALUES (?, ?, ?)")
      .run(kind, id, JSON.stringify(value));
  }
  private all<T>(kind: string): T[] {
    return this.store.db
      .prepare("SELECT document FROM demo_records WHERE kind = ?")
      .all(kind)
      .map((row) => JSON.parse(row.document as string));
  }
  async initialize() {
    const signer = privateKeyToAccount(DEMO_KEY);
    for (const manifest of sampleManifests(this.issuer, this.issuer)) {
      if (this.read("plan", manifest.planId)) continue;
      const reference = await this.uploadJson({
        manifest,
        signature: await signer.signMessage({
          message: manifestMessage(manifest),
        }),
      });
      this.register(manifest, reference);
      await this.publishListing(
        listingFromManifest(manifest, reference),
        7 * 86400,
      );
    }
  }
  async uploadJson(value: unknown): Promise<Hex> {
    const reference = await contentReference(
      new TextEncoder().encode(canonical(value)),
    );
    this.write("document", reference, value);
    return reference;
  }
  async readJson(reference: Hex): Promise<unknown> {
    const document = this.read("document", reference);
    if (!document) throw new AppError("SWARM_READ_UNAVAILABLE", 503);
    return document;
  }
  async readManifest(reference: Hex) {
    const signed = signedManifestSchema.parse(await this.readJson(reference));
    if (
      !(await verifyMessage({
        address: signed.manifest.provider,
        message: manifestMessage(signed.manifest),
        signature: signed.signature as Hex,
      }))
    )
      throw new AppError("INVALID_MANIFEST_SIGNATURE", 400);
    return signed;
  }
  register(manifest: Manifest, manifestRef: Hex) {
    const plan: Plan = {
      serviceId: manifest.serviceId,
      provider: manifest.provider,
      treasury: manifest.treasury,
      priceAtomic: manifest.priceAtomic,
      durationSeconds: manifest.durationSeconds,
      feeBps: manifest.feeBps,
      manifestRef,
      active: true,
    };
    const existing = this.read<Plan>("plan", manifest.planId);
    if (existing && canonical(existing) !== canonical(plan))
      throw new AppError("PLAN_MISMATCH", 409);
    this.write("plan", manifest.planId, plan);
  }
  async getPlan(planId: Hex): Promise<Plan> {
    const plan = this.read<Plan>("plan", planId);
    if (!plan) throw new AppError("PLAN_NOT_FOUND", 404);
    return plan;
  }
  async listServices(filters: { category?: string; maxPriceAtomic?: string }) {
    return this.all<Listing>("listing")
      .filter(
        (l) =>
          this.listingActive(l.planId) &&
          (!filters.category || l.category === filters.category) &&
          (!filters.maxPriceAtomic ||
            BigInt(l.priceAtomic) <= BigInt(filters.maxPriceAtomic)),
      )
      .slice(0, 100);
  }
  private listingActive(planId: Hex) {
    const expires = this.read<string>("listing-expiry", planId);
    return !expires || this.head() < BigInt(expires);
  }
  async getListing(planId: Hex) {
    return this.listingActive(planId)
      ? this.read<Listing>("listing", planId)
      : undefined;
  }
  async publishListing(
    listing: Listing,
    seconds: number,
    _capture?: (tx: SignedTransaction) => void,
  ) {
    const activation = this.activation(seconds, listing.planId);
    this.write("listing", listing.planId, listing);
    this.write("listing-expiry", listing.planId, activation.expiresAtBlock);
    return activation;
  }
  pay(intent: Intent): Payment {
    const saved = this.read<Payment>("payment", intent.id);
    if (saved) return saved;
    const payment = {
      purchaseId: purchaseId(43113, this.address, intent.payer, intent.id),
      txHash: namedId(randomUUID()),
      blockNumber: this.head().toString(),
      blockHash: namedId("local-block"),
    };
    this.write("payment", intent.id, payment);
    return payment;
  }
  async verifyPayment(
    intent: Intent,
    txHash: Hex,
    _manifest: Manifest,
  ): Promise<Payment> {
    const payment = this.read<Payment>("payment", intent.id);
    if (
      !payment ||
      payment.txHash !== txHash ||
      payment.purchaseId !==
        purchaseId(43113, this.address, intent.payer, intent.id)
    )
      throw new AppError("PURCHASE_MISMATCH", 409);
    return payment;
  }
  private head() {
    return BigInt(Math.floor(Date.now() / 2000));
  }
  private activation(seconds: number, id: Hex): Activation {
    return {
      entityKey: namedId(`local-entity:${id}`),
      txHash: namedId(`local-create:${id}`),
      createdAtBlock: this.head().toString(),
      expiresAtBlock: (this.head() + BigInt(seconds / 2)).toString(),
    };
  }
  async createEntitlement(
    entitlement: Entitlement,
    capture: (tx: SignedTransaction) => void,
  ) {
    const activation = this.activation(
      entitlement.durationSeconds,
      entitlement.purchaseId,
    );
    const raw = namedId(`local-signed:${entitlement.purchaseId}`);
    this.write("activation", raw, { entitlement, activation });
    capture({ raw, hash: namedId(raw) });
    return activation;
  }
  async recoverEntitlement(tx: SignedTransaction) {
    const saved = this.read<{ activation: Activation }>("activation", tx.raw);
    if (!saved) throw new AppError("ARKIV_TRANSACTION_REVERTED", 409);
    return saved.activation;
  }
  async checkEntitlement(expected: Entitlement, activation: Activation) {
    const stored = this.read<{
      entitlement: Entitlement;
      activation: Activation;
    }>("activation", namedId(`local-signed:${expected.purchaseId}`));
    const head = this.head();
    return {
      head,
      active:
        !!stored &&
        canonical(stored.entitlement) === canonical(expected) &&
        canonical(stored.activation) === canonical(activation) &&
        head < BigInt(activation.expiresAtBlock),
    };
  }
}
