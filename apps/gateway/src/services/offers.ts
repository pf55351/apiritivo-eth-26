import { verifyMessage, type Hex } from "viem";
import {
  AppError,
  canonical,
  listingFromManifest,
  manifestMessage,
  publicationMessage,
  signedManifestSchema,
  type Activation,
  type SignedManifest,
  type SignedTransaction,
} from "../../../../packages/domain/src/index.ts";
import type {
  ArkivPort,
  MarketPort,
  SwarmPort,
} from "../../../../packages/domain/src/ports.ts";
import { assertPlan } from "../../../../packages/avalanche/src/client.ts";
import type { Store } from "../db/store.ts";
import type { ActivationWorker } from "../workers/activation.ts";

export type Offer = {
  subject: Hex;
  signed: SignedManifest;
  reference?: Hex;
  transaction?: SignedTransaction;
  activation?: Activation;
};
export class Offers {
  constructor(
    private store: Store,
    private market: MarketPort,
    private arkiv: ArkivPort,
    private swarm: SwarmPort,
    private owner?: () => Promise<Hex>,
  ) {
    store.db.exec(
      "CREATE TABLE IF NOT EXISTS offer_publications (plan_id TEXT PRIMARY KEY, subject TEXT NOT NULL, document TEXT NOT NULL)",
    );
  }
  get(planId: Hex, subject: Hex): Offer {
    const row = this.store.db
      .prepare(
        "SELECT document FROM offer_publications WHERE plan_id = ? AND subject = ?",
      )
      .get(planId, subject);
    if (!row) throw new AppError("OFFER_NOT_FOUND", 404);
    return JSON.parse(row.document as string);
  }
  list(subject: Hex) {
    return this.store.db
      .prepare(
        "SELECT document FROM offer_publications WHERE subject = ? LIMIT 100",
      )
      .all(subject)
      .map((row) => this.view(JSON.parse(row.document as string)));
  }
  private save(offer: Offer) {
    this.store.db
      .prepare(
        "INSERT INTO offer_publications VALUES (?, ?, ?) ON CONFLICT(plan_id) DO UPDATE SET document = excluded.document",
      )
      .run(offer.signed.manifest.planId, offer.subject, JSON.stringify(offer));
  }
  pending() {
    return this.store.db
      .prepare("SELECT document FROM offer_publications")
      .all()
      .map((row) => JSON.parse(row.document as string) as Offer)
      .find((o) => o.transaction && !o.activation);
  }
  view(offer: Offer) {
    return {
      manifest: offer.signed.manifest,
      reference: offer.reference,
      activation: offer.activation,
      status: offer.activation ? ("published" as const) : ("prepared" as const),
    };
  }
  async prepare(subject: Hex, body: unknown) {
    const { authorization, ...signed } = signedManifestSchema
        .extend({ authorization: signedManifestSchema.shape.signature })
        .parse(body),
      manifest = signed.manifest;
    if (
      !(await verifyMessage({
        address: manifest.provider,
        message: publicationMessage(subject, manifest),
        signature: authorization as Hex,
      }))
    )
      throw new AppError("INVALID_PUBLISHER_PROOF", 403);
    return this.prepareOwned(subject, signed);
  }
  async resume(subject: Hex, planId: Hex) {
    return this.prepareOwned(subject, this.get(planId, subject).signed);
  }
  private async prepareOwned(subject: Hex, signed: SignedManifest) {
    const manifest = signed.manifest;
    if (
      !(await verifyMessage({
        address: manifest.provider,
        message: manifestMessage(manifest),
        signature: signed.signature as Hex,
      }))
    )
      throw new AppError("INVALID_MANIFEST_SIGNATURE", 400);
    // Live MVP registration is operator-only, matching AccessMarket.registerPlan.
    if (this.owner && manifest.provider !== (await this.owner()).toLowerCase())
      throw new AppError("PUBLISHER_NOT_AUTHORIZED", 403);
    let offer: Offer;
    const row = this.store.db
      .prepare("SELECT document FROM offer_publications WHERE plan_id = ?")
      .get(manifest.planId);
    if (row) {
      offer = JSON.parse(row.document as string);
      if (
        offer.subject !== subject ||
        canonical(offer.signed) !== canonical(signed)
      )
        throw new AppError("PLAN_MISMATCH", 409);
    } else {
      offer = { subject, signed };
      this.save(offer);
    }
    if (!offer.reference) {
      offer.reference = await this.swarm.uploadJson(signed);
      this.save(offer);
    }
    return this.view(offer);
  }
  async recoverPending() {
    const offer = this.pending();
    if (!offer?.transaction) return;
    offer.activation = await this.arkiv.recoverEntitlement(offer.transaction);
    this.save(offer);
  }
  async publish(subject: Hex, planId: Hex, worker: ActivationWorker) {
    return worker.exclusive(async () => {
      const offer = this.get(planId, subject);
      if (offer.activation) return this.view(offer);
      if (!offer.reference) throw new AppError("MANIFEST_NOT_UPLOADED", 409);
      const unresolved = this.pending();
      if (unresolved && unresolved.signed.manifest.planId !== planId)
        throw new AppError("ISSUER_BUSY", 409);
      assertPlan(
        offer.signed.manifest,
        await this.market.getPlan(planId),
        offer.reference,
      );
      offer.activation = offer.transaction
        ? await this.arkiv.recoverEntitlement(offer.transaction)
        : await this.arkiv.publishListing(
            listingFromManifest(offer.signed.manifest, offer.reference),
            7 * 86400,
            (tx) => {
              offer.transaction = tx;
              this.save(offer);
            },
          );
      this.save(offer);
      return this.view(offer);
    });
  }
}
