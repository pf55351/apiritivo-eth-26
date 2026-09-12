import { useEffect, useState, type FormEvent } from "react";
import { parseUnits, type Hex } from "viem";
import {
  FUJI_USDC,
  manifestMessage,
  publicationMessage,
  manifestSchema,
  namedId,
  type SignedManifest,
} from "../../../packages/domain/src/index.ts";
import {
  api,
  download,
  price,
  duration,
  short,
  saved,
  type Offer,
} from "./api.ts";
import { connectWallet, demoAccount, registerPlan } from "./wallet.ts";
import { Empty, Tag, useApp } from "./App.tsx";

export function Studio() {
  const {
    subject,
    requireLogin,
    config,
    busy,
    run,
    refresh,
    bump,
    notify,
    go,
  } = useApp();
  const [offers, setOffers] = useState<Offer[]>([]),
    [loadError, setLoadError] = useState(""),
    [operation, setOperation] = useState("text.analyze"),
    [previewPrice, setPreviewPrice] = useState("0.10"),
    [seconds, setSeconds] = useState("60");
  const draftKey = `apiperitivo.draft.${config.mode}.${subject}`;
  const [draft, setDraft] = useState<SignedManifest & { authorization: Hex }>();
  useEffect(() => {
    setDraft(saved<SignedManifest & { authorization: Hex }>(draftKey));
  }, [draftKey]);
  useEffect(() => {
    if (!subject) return;
    let alive = true;
    void api<{ offers: Offer[] }>("/offers")
      .then((data) => {
        if (alive) {
          setOffers(data.offers);
          setLoadError("");
        }
      })
      .catch((e) => {
        if (alive) setLoadError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [subject, refresh]);
  async function complete(offer: Offer) {
    if (!offer.reference)
      offer = await api<Offer>(`/offers/${offer.manifest.planId}/prepare`, {});
    if (config.mode === "demo")
      await api("/demo/register", { planId: offer.manifest.planId });
    else {
      if (!config.market)
        throw new Error("The testnet market is not configured.");
      await registerPlan(config.market, offer.manifest, offer.reference!);
    }
    await api(`/offers/${offer.manifest.planId}/publish`, {});
    if (draft?.manifest.planId === offer.manifest.planId) {
      localStorage.removeItem(draftKey);
      setDraft(undefined);
    }
    bump();
    notify(
      `${offer.manifest.name} is published. It’s now available on the menu.`,
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form);
    await run("Signing your offer and publishing its terms…", async () => {
      if (parseUnits(String(values.get("price")), 6) <= 0n)
        throw new Error("Enter a price of at least 0.000001 USDC.");
      if (
        !String(values.get("name")).trim() ||
        !String(values.get("description")).trim() ||
        !String(values.get("terms")).trim()
      )
        throw new Error("Add a name, a description and terms of access.");
      let manifest = manifestSchema.parse({
        schemaVersion: 1,
        app: "apiperitivo",
        serviceId: namedId(crypto.randomUUID()),
        planId: namedId(crypto.randomUUID()),
        name: String(values.get("name")).trim(),
        description: String(values.get("description")).trim(),
        version: "1.0.0",
        category: values.get("category"),
        provider:
          config.mode === "demo" ? demoAccount().address : config.treasury,
        treasury: config.treasury,
        chainId: 43113,
        token: FUJI_USDC,
        priceAtomic: parseUnits(String(values.get("price")), 6).toString(),
        durationSeconds: Number(values.get("duration")),
        feeBps: config.feeBps,
        operations: [operation],
        limits: {
          requestsPerMinute: Number(values.get("rate")),
          concurrency: Number(values.get("concurrency")),
          bodyBytes: 65536,
          timeoutMs: 5000,
        },
        terms: String(values.get("terms")).trim(),
      });
      let signature: Hex, authorization: Hex;
      if (config.mode === "demo") {
        signature = await demoAccount().signMessage({
          message: manifestMessage(manifest),
        });
        authorization = await demoAccount().signMessage({
          message: publicationMessage(subject!, manifest),
        });
      } else {
        const { wallet, account } = await connectWallet();
        manifest = { ...manifest, provider: account.toLowerCase() as Hex };
        signature = await wallet.signMessage({
          account,
          message: manifestMessage(manifest),
        });
        authorization = await wallet.signMessage({
          account,
          message: publicationMessage(subject!, manifest),
        });
      }
      const signed = { manifest, signature, authorization };
      localStorage.setItem(draftKey, JSON.stringify(signed));
      setDraft(signed);
      if (
        config.mode === "testnet" &&
        (!config.ready.publishing ||
          manifest.provider !== config.publisher?.toLowerCase())
      ) {
        download("apiritivo-signed-offer.json", signed);
        notify(
          "Signed draft exported. Publishing requires configured Swarm storage, an Arkiv issuer, and the market operator wallet.",
        );
        return;
      }
      const prepared = await api<Offer>("/offers", signed);
      bump();
      await complete(prepared);
      localStorage.removeItem(draftKey);
      setDraft(undefined);
      form.reset();
      setPreviewPrice("0.10");
      setSeconds("60");
      setOperation("text.analyze");
    });
  }
  if (!subject)
    return (
      <Empty title="Got something useful to serve?">
        <p>Sign in to create a timed offer and put it on the menu.</p>
        <button className="button" onClick={() => requireLogin("studio")}>
          Sign in to create an offer ↗
        </button>
      </Empty>
    );
  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE PROVIDER STUDIO</p>
          <h1>
            Your API. <em>On the menu.</em>
          </h1>
          <p className="lead">
            A clear offer, a fair price, and a little window of possibility.
          </p>
        </div>
        <Tag tone="green">
          {config.mode === "demo"
            ? "Local publishing is ready"
            : "Testnet publishing"}
        </Tag>
      </div>
      {config.mode === "testnet" && (
        <div className="notice">
          <span>
            The current market allows its operator to publish:{" "}
            <code>
              {config.publisher ? short(config.publisher) : "not configured"}
            </code>
            . Other wallets can export a signed draft for the operator.
          </span>
        </div>
      )}
      {draft && (
        <div className="recovery panel">
          <Tag tone="orange">Saved signed draft</Tag>
          <h3>{draft.manifest.name}</h3>
          <p>
            Your exact signed terms are saved. Resume this offer to avoid
            creating a duplicate.
          </p>
          <div className="button-row">
            <button
              className="button"
              disabled={!!busy || !config.ready.publishing}
              onClick={() =>
                void run("Resuming publication…", async () => {
                  const offer = await api<Offer>("/offers", draft);
                  bump();
                  await complete(offer);
                })
              }
            >
              Resume publication →
            </button>
            <button
              className="button secondary"
              onClick={() => download("apiritivo-signed-offer.json", draft)}
            >
              Export draft ↓
            </button>
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() => {
                download("apiritivo-signed-offer.json", draft);
                localStorage.removeItem(draftKey);
                setDraft(undefined);
              }}
            >
              Clear local draft
            </button>
          </div>
        </div>
      )}
      <div className="studio-layout">
        <form className="offer-form" onSubmit={(e) => void submit(e)}>
          <div className="form-section">
            <span className="step-number">01</span>
            <div>
              <h2>Start with the good stuff.</h2>
              <p>Choose a working API tool, then make the offer your own.</p>
              <label>
                API tool
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value)}
                >
                  <option value="text.analyze">
                    Text analysis — counts, frequencies & reading time
                  </option>
                  <option value="json.transform">
                    JSON transformation — select fields from records
                  </option>
                </select>
              </label>
              <p className="fine-print">
                These two operations are implemented by the gateway. Connecting
                another API requires a provider adapter.
              </p>
              <label>
                Offer name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g. The Copywriter’s Spritz"
                />
              </label>
              <label>
                What does it do?
                <textarea
                  name="description"
                  required
                  maxLength={2000}
                  rows={3}
                  placeholder="A short, useful description of what someone can make with your API."
                />
              </label>
              <label>
                Category
                <select name="category" defaultValue="text">
                  <option value="text">Text</option>
                  <option value="data">Data</option>
                  <option value="utilities">Utilities</option>
                </select>
              </label>
            </div>
          </div>
          <div className="form-section">
            <span className="step-number">02</span>
            <div>
              <h2>Set the time and the tab.</h2>
              <p>One fixed price for the whole access window.</p>
              <div className="form-columns">
                <label>
                  Price in {config.mode === "demo" ? "demo" : "test"} USDC
                  <input
                    name="price"
                    required
                    inputMode="decimal"
                    pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?"
                    value={previewPrice}
                    onChange={(e) => setPreviewPrice(e.target.value)}
                    aria-describedby="price-help"
                  />
                </label>
                <label>
                  Access duration
                  <select
                    name="duration"
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value)}
                  >
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="300">5 minutes</option>
                    <option value="1800">30 minutes</option>
                    <option value="3600">1 hour</option>
                  </select>
                </label>
              </div>
              <p id="price-help" className="fine-print">
                Minimum 0.000001 USDC. Up to 6 decimal places. Platform fee:{" "}
                {config.feeBps / 100}% included in your price.
              </p>
              <div className="form-columns">
                <label>
                  Calls per minute
                  <input
                    name="rate"
                    type="number"
                    min="1"
                    max="600"
                    required
                    defaultValue="60"
                  />
                </label>
                <label>
                  Concurrent requests
                  <input
                    name="concurrency"
                    type="number"
                    min="1"
                    max="20"
                    required
                    defaultValue="2"
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="form-section">
            <span className="step-number">03</span>
            <div>
              <h2>Clear terms. Happy people.</h2>
              <label>
                Terms of access
                <textarea
                  name="terms"
                  required
                  maxLength={4000}
                  rows={4}
                  defaultValue="Access begins when the pass activates. One payment covers the selected time window, subject to the displayed rate and concurrency limits. The gateway checks access on every call. Test funds only. Activation is asynchronous; no automatic refund."
                />
              </label>
              <p className="fine-print">
                Terms are signed and immutable. To change a published offer,
                create a new plan. Its catalog listing lasts 7 days; pass
                duration is separate.
              </p>
              <button
                className="button"
                type="submit"
                disabled={!!busy || !!draft || !config.treasury}
              >
                {config.mode === "demo"
                  ? "Publish your demo offer"
                  : "Sign & publish offer"}{" "}
                <span>↗</span>
              </button>
              {!config.treasury && (
                <p role="status">
                  Configure TREASURY_ADDRESS before creating testnet offers.
                </p>
              )}
            </div>
          </div>
        </form>
        <aside className="studio-note">
          <span className="note-star">✳</span>
          <p className="eyebrow">A GOOD OFFER IS SIMPLE</p>
          <h2>
            Keep it short.
            <br />
            Make it <em>useful.</em>
          </h2>
          <p>
            People come here for a task, not a commitment. Help them understand
            exactly what they’ll get.
          </p>
          <div className="preview-price">
            <strong>{previewPrice || "0"}</strong>
            <span>
              {config.mode === "demo" ? "demo" : "test"} USDC /{" "}
              {duration(Number(seconds))}
            </span>
          </div>
          <ul>
            <li>A name they’ll remember.</li>
            <li>A description that says what it does.</li>
            <li>Enough time to make something.</li>
          </ul>
          <p className="fine-print">
            {config.mode === "demo"
              ? "In this demo, terms and listings are stored locally. Publishing uses no real funds."
              : "Your signed manifest goes to Swarm. The plan is registered on Fuji, then listed on Arkiv."}
          </p>
        </aside>
      </div>
      <section className="published-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FROM YOUR STUDIO</p>
            <h2>Your offers</h2>
          </div>
          <button className="text-button" onClick={bump}>
            Refresh ↻
          </button>
        </div>
        {loadError && <p role="alert">{loadError}</p>}
        {!offers.length ? (
          <p className="muted">
            Your first offer will appear here after you sign it.
          </p>
        ) : (
          offers.map((offer) => (
            <div className="published-row" key={offer.manifest.planId}>
              <div>
                <Tag tone={offer.status === "published" ? "green" : "orange"}>
                  {offer.status === "published"
                    ? "Published"
                    : "Awaiting publication"}
                </Tag>
                <h3>{offer.manifest.name}</h3>
                <p>
                  {price(offer.manifest.priceAtomic)} USDC ·{" "}
                  {duration(offer.manifest.durationSeconds)} ·{" "}
                  {short(offer.manifest.planId)}
                </p>
              </div>
              <div className="button-row">
                <button
                  className="text-button"
                  onClick={() =>
                    download("apiritivo-offer-record.json", offer)
                  }
                >
                  Export record ↓
                </button>
                {offer.status !== "published" ? (
                  <button
                    className="button secondary"
                    disabled={!!busy || !config.ready.publishing}
                    onClick={() =>
                      void run("Completing publication…", () => complete(offer))
                    }
                  >
                    Finish publishing ↗
                  </button>
                ) : (
                  <button
                    className="button secondary"
                    onClick={() => go("explore")}
                  >
                    View the menu ↗
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </section>
  );
}
