import { afterEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage, type Hex } from "viem";
import { Store } from "../apps/gateway/src/db/store.ts";
import { createApp } from "../apps/gateway/src/app.ts";
import { configSchema } from "../apps/gateway/src/config.ts";
import { DemoNetwork, DEMO_KEY } from "../apps/gateway/src/demo/network.ts";
import { identityFromSeed } from "../packages/auth/src/proof.ts";
import {
  manifestMessage,
  publicationMessage,
  receiptMessage,
  namedId,
  type Manifest,
} from "../packages/domain/src/index.ts";
import { sampleManifests } from "../scripts/sample-manifests.ts";
import { Offers } from "../apps/gateway/src/services/offers.ts";
import { ActivationWorker } from "../apps/gateway/src/workers/activation.ts";
import { fixture, activation, signedTx } from "./fixtures.ts";

async function demoFixture() {
  const store = new Store(":memory:"),
    demo = new DemoNetwork(store);
  await demo.initialize();
  const config = configSchema.parse({
    NODE_ENV: "test",
    APP_ORIGIN: "http://localhost:3002",
    RECEIPT_PRIVATE_KEY: DEMO_KEY,
  });
  const { api, worker } = await createApp({
    config,
    store,
    demo,
    arkiv: demo,
    market: demo,
    swarm: demo,
  });
  await api.ready();
  const headers: Record<string, string> = { origin: config.APP_ORIGIN };
  const identity = identityFromSeed(new Uint8Array(32).fill(33));
  const challenge = (
    await api.inject({
      method: "POST",
      url: "/api/auth/challenge",
      headers,
      payload: { publicKey: identity.publicKey },
    })
  ).json();
  const login = await api.inject({
    method: "POST",
    url: "/api/auth/verify",
    headers,
    payload: {
      challengeId: challenge.id,
      signature: identity.signChallenge(challenge),
    },
  });
  headers.cookie = `apiperitivo_session=${login.cookies[0].value}`;
  const post = (url: string, payload: unknown = {}) =>
    api.inject({
      method: "POST",
      url: `/api${url}`,
      headers,
      payload: payload as object,
    });
  const get = (url: string) =>
    api.inject({ method: "GET", url: `/api${url}`, headers });
  const manifest = sampleManifests(demo.issuer, demo.issuer)[0];
  const sign = async (m: Manifest = manifest, subject = identity.subject) => ({
    manifest: m,
    signature: await privateKeyToAccount(DEMO_KEY).signMessage({
      message: manifestMessage(m),
    }),
    authorization: await privateKeyToAccount(DEMO_KEY).signMessage({
      message: publicationMessage(subject, m),
    }),
  });
  const buy = async (planId = manifest.planId) => {
    const prepared = (
      await post("/purchases/prepare", { planId, payer: demo.issuer })
    ).json();
    const payment = (
      await post("/demo/pay", { purchaseIntentId: prepared.purchaseIntentId })
    ).json();
    const result = await post("/purchases/confirm", {
      purchaseIntentId: prepared.purchaseIntentId,
      txHash: payment.txHash,
    });
    expect(result.statusCode).toBe(202);
    return { prepared, payment, pass: result.json() };
  };
  return {
    api,
    worker: worker!,
    store,
    demo,
    post,
    get,
    sign,
    manifest,
    buy,
    identity,
    headers,
    close: async () => {
      await api.close();
      store.close();
    },
  };
}
afterEach(() => vi.restoreAllMocks());
describe("complete local demo", () => {
  it("seeds two signed offers idempotently and runs actual APIs until the exact expiry", async () => {
    const f = await demoFixture();
    try {
      await f.demo.initialize();
      expect((await f.get("/services")).json().services).toHaveLength(2);
      expect((await f.get("/config")).json().mode).toBe("demo");
      expect((await f.get("/auth/session")).json().subject).toBe(
        f.identity.subject,
      );
      const { pass, prepared, payment } = await f.buy();
      expect(
        (
          await f.post("/demo/pay", {
            purchaseIntentId: prepared.purchaseIntentId,
          })
        ).json(),
      ).toEqual(payment);
      expect(
        (
          await f.post(`/passes/${pass.purchaseId}/invoke/text.analyze`, {
            text: "Ciao ciao Roma",
          })
        ).statusCode,
      ).toBe(403);
      await f.worker.tick();
      const output = await f.post(
        `/passes/${pass.purchaseId}/invoke/text.analyze`,
        { text: "Ciao ciao Roma" },
      );
      expect(output.json().data.words).toBe(3);
      expect(output.json().data.uniqueWords).toBe(2);
      const passes = (await f.get("/passes")).json().passes;
      expect(passes[0].access).toBe("active");
      expect(passes[0].remainingSeconds).toBeGreaterThan(0);
      expect(JSON.stringify(passes)).not.toContain("signedTransaction");
      expect(
        (await f.post(`/purchases/${pass.purchaseId}/receipt`)).statusCode,
      ).toBe(409);
      vi.spyOn(Date, "now").mockReturnValue(
        Number(passes[0].activation.expiresAtBlock) * 2000,
      );
      const expired = await f.post(
        `/passes/${pass.purchaseId}/invoke/text.analyze`,
        { text: "Blocked" },
      );
      expect(expired.json().error.code).toBe("ACCESS_EXPIRED");
      const receipt = (
        await f.post(`/purchases/${pass.purchaseId}/receipt`)
      ).json();
      expect(receipt.receipt.usage.admitted).toBe(1);
      expect(
        await verifyMessage({
          address: receipt.signer,
          message: receiptMessage(receipt.receipt),
          signature: receipt.signature,
        }),
      ).toBe(true);
      expect(
        (await f.post(`/purchases/${pass.purchaseId}/receipt`)).json(),
      ).toEqual(receipt);
    } finally {
      await f.close();
    }
  });
  it("publishes a new signed plan, verifies terms and permits purchase of the created offer", async () => {
    const f = await demoFixture();
    try {
      const m = {
        ...f.manifest,
        name: "Short Spritz",
        planId: namedId("new-offer"),
        durationSeconds: 30,
      };
      const prepared = await f.post("/offers", await f.sign(m));
      expect(prepared.statusCode).toBe(200);
      expect((await f.post(`/offers/${m.planId}/publish`)).statusCode).toBe(
        404,
      );
      expect(
        (await f.post("/demo/register", { planId: m.planId })).statusCode,
      ).toBe(200);
      const published = await f.post(`/offers/${m.planId}/publish`);
      expect(published.json().status).toBe("published");
      expect((await f.post(`/offers/${m.planId}/publish`)).json()).toEqual(
        published.json(),
      );
      expect((await f.get("/services")).json().services).toHaveLength(3);
      expect((await f.get(`/plans/${m.planId}`)).json().manifest).toEqual(m);
      const { pass } = await f.buy(m.planId);
      await f.worker.tick();
      expect(
        f.store.getPurchase(pass.purchaseId)!.manifest.durationSeconds,
      ).toBe(30);
    } finally {
      await f.close();
    }
  });
  it("rejects copied publisher proofs, changed terms and foreign sessions", async () => {
    const f = await demoFixture();
    try {
      const m = { ...f.manifest, planId: namedId("secured-offer") },
        signed = await f.sign(m);
      expect(
        (
          await f.post("/offers", {
            ...signed,
            authorization: (await f.sign(m, namedId("someone-else")))
              .authorization,
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await f.post("/offers", {
            ...signed,
            manifest: { ...m, priceAtomic: "1" },
          })
        ).statusCode,
      ).toBe(403);
      expect((await f.post("/offers", signed)).statusCode).toBe(200);
      expect(
        (await f.post("/offers", await f.sign({ ...m, name: "Changed" })))
          .statusCode,
      ).toBe(409);
      const other = f.store.createSession(namedId("other"));
      const foreign = await f.api.inject({
        method: "POST",
        url: `/api/offers/${m.planId}/publish`,
        headers: { ...f.headers, cookie: `apiperitivo_session=${other}` },
        payload: {},
      });
      expect(foreign.statusCode).toBe(404);
      const read = await f.api.inject({ method: "GET", url: "/api/offers" });
      expect(read.statusCode).toBe(401);
      const { prepared } = await f.buy();
      expect(
        (
          await f.api.inject({
            method: "POST",
            url: "/api/demo/pay",
            headers: { ...f.headers, cookie: `apiperitivo_session=${other}` },
            payload: { purchaseIntentId: prepared.purchaseIntentId },
          })
        ).statusCode,
      ).toBe(404);
    } finally {
      await f.close();
    }
  });
  it("recovers an uploaded draft after a storage outage without changing its identity", async () => {
    const f = await demoFixture();
    try {
      const m = { ...f.manifest, planId: namedId("upload-recovery") };
      vi.spyOn(f.demo, "uploadJson").mockRejectedValueOnce(
        new Error("Bee unavailable"),
      );
      expect((await f.post("/offers", await f.sign(m))).statusCode).toBe(503);
      expect((await f.get("/offers")).json().offers[0].manifest.planId).toBe(
        m.planId,
      );
      const recovered = await f.post(`/offers/${m.planId}/prepare`);
      expect(recovered.statusCode).toBe(200);
      expect(recovered.json().reference).toMatch(/^0x[0-9a-f]{64}$/);
    } finally {
      await f.close();
    }
  });
  it("keeps local simulated-payment endpoints out of the real gateway", async () => {
    const f = await fixture();
    try {
      expect(
        (
          await f.api.inject({
            method: "POST",
            url: "/api/demo/pay",
            headers: f.headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(404);
      expect((await f.api.inject("/api/config")).json().mode).toBe("testnet");
      const store = new Store(":memory:"),
        demo = new DemoNetwork(store);
      try {
        await expect(
          createApp({
            config: configSchema.parse({
              NODE_ENV: "production",
              APP_ORIGIN: "https://example.test",
            }),
            store,
            demo,
            swarm: demo,
          }),
        ).rejects.toThrow("Demo adapters cannot run in production");
      } finally {
        store.close();
      }
    } finally {
      await f.close();
    }
  });
  it("reserves the issuer while publication is in progress and automatically recovers saved signed bytes", async () => {
    const f = await demoFixture();
    try {
      const m = { ...f.manifest, planId: namedId("publication-retry") },
        offers = new Offers(f.store, f.demo, f.demo, f.demo);
      const prepared = await offers.prepare(
        f.identity.subject,
        await f.sign(m),
      );
      f.demo.register(m, prepared.reference!);
      const publish = vi
        .spyOn(f.demo, "publishListing")
        .mockImplementationOnce(async (_l, _seconds, capture) => {
          capture!(signedTx);
          throw new Error("Transport lost the response");
        });
      await expect(
        offers.publish(f.identity.subject, m.planId, f.worker),
      ).rejects.toThrow("Transport");
      const recover = vi
        .spyOn(f.demo, "recoverEntitlement")
        .mockResolvedValueOnce(activation);
      await f.worker.tick();
      expect(recover).toHaveBeenCalledWith(signedTx);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(offers.get(m.planId, f.identity.subject).activation).toEqual(
        activation,
      );
      let release!: () => void;
      const lock = f.worker.exclusive(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      await expect(f.worker.exclusive(async () => {})).rejects.toMatchObject({
        code: "ISSUER_BUSY",
      });
      release();
      await lock;
    } finally {
      await f.close();
    }
  });
  it("requires the live market owner before using funded publication adapters", async () => {
    const f = await demoFixture();
    try {
      const offers = new Offers(
        f.store,
        f.demo,
        f.demo,
        f.demo,
        async () => `0x${"34".repeat(20)}` as Hex,
      );
      await expect(
        offers.prepare(f.identity.subject, await f.sign()),
      ).rejects.toMatchObject({ code: "PUBLISHER_NOT_AUTHORIZED" });
    } finally {
      await f.close();
    }
  });
  it("expires catalog listings independently while retaining their immutable manifest reference", async () => {
    const f = await demoFixture();
    try {
      const listing = (await f.demo.getListing(f.manifest.planId))!;
      const activation = await f.demo.publishListing(listing, 30);
      vi.spyOn(Date, "now").mockReturnValue(
        Number(activation.expiresAtBlock) * 2000,
      );
      expect(await f.demo.getListing(listing.planId)).toBeUndefined();
      expect((await f.demo.getPlan(listing.planId)).manifestRef).toBe(
        listing.manifestRef,
      );
      expect((await f.demo.readManifest(listing.manifestRef)).manifest).toEqual(
        f.manifest,
      );
    } finally {
      await f.close();
    }
  });
});
