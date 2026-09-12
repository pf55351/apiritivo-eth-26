import { useEffect, useState } from "react";
import type { Hex } from "viem";
import type { Listing } from "../../../packages/domain/src/index.ts";
import {
  api,
  price,
  duration,
  short,
  type Plan,
  type Prepared,
  type Pending,
  type Pass,
} from "./api.ts";
import { Empty, Tag, useApp } from "./App.tsx";

export function Cocktail({ variant = "text" }: { variant?: string }) {
  return (
    <svg
      viewBox="0 0 100 110"
      className={`cocktail ${variant}`}
      aria-hidden="true"
    >
      <path d="M22 25h56L50 68Z" fill="var(--drink)" opacity=".85" />
      <path
        d="M21 19h58L50 70Zm29 51v26m-17 0h34"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="m67 7-20 45" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="55" cy="32" rx="8" ry="6" fill="var(--olive)" />
      <circle cx="56" cy="32" r="2" fill="#fcf6e6" />
    </svg>
  );
}
export function Catalog() {
  const {
    config,
    refresh,
    run,
    busy,
    subject,
    requireLogin,
    go,
    setPending,
    pending,
    bump,
  } = useApp();
  const [listings, setListings] = useState<Listing[]>([]),
    [selected, setSelected] = useState<Hex>(
      () => sessionStorage.getItem("apiperitivo.selected-plan") as Hex,
    ),
    [loadedPlan, setPlan] = useState<Plan>();
  const plan =
    loadedPlan?.manifest.planId === selected ? loadedPlan : undefined;
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [detailError, setDetailError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    void api<{ services: Listing[] }>("/services")
      .then((data) => {
        if (active) {
          setListings(data.services);
          setSelected((old) =>
            data.services.some((l) => l.planId === old)
              ? old
              : data.services[0]?.planId,
          );
        }
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setPlan(undefined);
    setDetailError("");
    if (selected)
      void api<Plan>(`/plans/${selected}`)
        .then((data) => {
          if (active) setPlan(data);
        })
        .catch((e) => {
          if (active) setDetailError(e.message);
        });
    return () => {
      active = false;
    };
  }, [selected, refresh]);
  const visible = listings.filter(
    (l) =>
      (category === "all" || l.category === category) &&
      l.name.toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    if (selected) sessionStorage.setItem("apiperitivo.selected-plan", selected);
  }, [selected]);
  useEffect(() => {
    if (visible.length && !visible.some((l) => l.planId === selected))
      setSelected(visible[0].planId);
  }, [query, category, listings]);
  async function checkout() {
    if (!plan || !requireLogin("explore")) return;
    if (pending) {
      go("passes");
      return;
    }
    await run(
      config.mode === "demo"
        ? "Preparing your demo pass…"
        : "Confirm the approval and purchase in your wallet…",
      async () => {
        const { connectWallet, demoAccount, sendCall, waitForTransaction } =
          await import("./wallet.ts");
        const payer =
          config.mode === "demo"
            ? demoAccount().address
            : (await connectWallet()).account;
        const prepared = await api<Prepared>("/purchases/prepare", {
          planId: plan.manifest.planId,
          payer,
        });
        let value: Pending = { planId: plan.manifest.planId, prepared, payer };
        setPending(value);
        if (config.mode === "demo") {
          const payment = await api<{ txHash: Hex }>("/demo/pay", {
            purchaseIntentId: prepared.purchaseIntentId,
          });
          value = { ...value, txHash: payment.txHash };
          setPending(value);
        } else {
          await waitForTransaction(await sendCall(prepared.approve, payer));
          value = { ...value, purchaseRequested: true };
          setPending(value);
          const txHash = await sendCall(prepared.purchase, payer);
          value = { ...value, txHash };
          setPending(value);
          await waitForTransaction(txHash);
        }
        await api<Pass>("/purchases/confirm", {
          purchaseIntentId: prepared.purchaseIntentId,
          txHash: value.txHash,
        });
        setPending(undefined);
        bump();
        go("passes");
      },
    );
  }
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">
            <span className="tiny-star">✳</span> THE API MENU, REIMAGINED
          </p>
          <h1>
            Great APIs.
            <br />
            By the <em>moment.</em>
          </h1>
          <p className="lead">
            Skip the subscription. Pick an API, grab a timed pass,
            <br className="desktop-break" /> and make something happen.
          </p>
          <a
            className="button"
            href="#menu"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("menu")?.scrollIntoView({
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "instant"
                  : "smooth",
              });
            }}
          >
            Find your next ingredient <span>↓</span>
          </a>
          <p className="hero-footnote">
            <span className="status-dot" /> One price. A window of access. Yours
            to use.
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="art-note">a short pour of possibility</span>
          <div className="coaster">
            <svg viewBox="0 0 280 280" className="coaster-text">
              <defs>
                <path id="circle-text" d="M140,25a115,115 0 1,1 -1,0" />
              </defs>
              <text>
                <textPath href="#circle-text" startOffset="2%">
                  GOOD APIS · GOOD TIMES · GOOD APIS · GOOD TIMES ·{" "}
                </textPath>
              </text>
            </svg>
            <Cocktail />
          </div>
          <div className="paper-ticket">
            <div>
              <span>ONE GOOD IDEA</span>
              <span>№ 001</span>
            </div>
            <strong>Just add an API.</strong>
            <p>Small commitment. Endless possibilities.</p>
            <div className="ticket-dashes" />
          </div>
          <span className="art-spark">✳</span>
        </div>
      </section>
      <section className="menu-section" id="menu">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FRESHLY POURED</p>
            <h2>
              What’s on the menu<span className="orange">?</span>
            </h2>
          </div>
          <span className="muted">
            {loading
              ? "Opening the menu…"
              : `${listings.length} ${listings.length === 1 ? "offer" : "offers"} to explore`}
          </span>
        </div>
        <div className="menu-toolbar">
          <div
            className="filters"
            role="group"
            aria-label="Filter API category"
          >
            {["all", "text", "data", "utilities"].map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c === "all" ? "All APIs" : c[0].toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search APIs"
              placeholder="Find an API…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {loadError ? (
          <Empty title="The menu is taking a moment.">
            <p>{loadError}</p>
            {!config.ready.catalog && (
              <p>
                Start <code>pnpm demo</code> for the local experience, or
                configure Arkiv for testnet.
              </p>
            )}
            <button className="button secondary" onClick={bump}>
              Reload the menu
            </button>
          </Empty>
        ) : loading ? (
          <div className="loading-skeleton" aria-label="Loading offers" />
        ) : !visible.length ? (
          <Empty title="Nothing on this part of the menu yet.">
            <p>
              {listings.length
                ? "Try another category or a different search."
                : "Publish the first offer from your studio."}
            </p>
            <button
              className="button secondary"
              onClick={() => {
                setQuery("");
                setCategory("all");
                if (!listings.length) go("studio");
              }}
            >
              {listings.length ? "Clear filters" : "Create an offer"}
            </button>
          </Empty>
        ) : (
          <div className="menu-layout">
            <div className="menu-list">
              {visible.map((listing, i) => (
                <button
                  className={`menu-item ${selected === listing.planId ? "selected" : ""}`}
                  key={listing.planId}
                  onClick={() => {
                    setSelected(listing.planId);
                    if (matchMedia("(max-width: 820px)").matches)
                      document
                        .querySelector(".plan-panel")
                        ?.scrollIntoView({
                          block: "start",
                          behavior: "instant",
                        });
                  }}
                  aria-pressed={selected === listing.planId}
                >
                  <span className="item-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className={`drink-tile ${listing.category}`}>
                    <Cocktail variant={listing.category} />
                  </div>
                  <div className="item-copy">
                    <span className="eyebrow">
                      {listing.category === "text"
                        ? "WORDS, WITH A TWIST"
                        : listing.category === "data"
                          ? "A FRESH TAKE ON DATA"
                          : "A USEFUL LITTLE EXTRA"}
                    </span>
                    <h3>{listing.name}</h3>
                    <p>
                      {listing.category === "text"
                        ? "Word counts, reading time & more."
                        : "Clean up records. Keep what matters."}
                    </p>
                    <span className="item-duration">
                      ◷ {duration(listing.durationSeconds)} access
                    </span>
                  </div>
                  <div className="item-price">
                    <strong>{price(listing.priceAtomic)}</strong>
                    <span>
                      {config.mode === "demo" ? "demo USDC" : "test USDC"}
                    </span>
                    <span className="item-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </div>
                </button>
              ))}
              <div className="menu-tail">
                <span>Something of your own to serve?</span>
                <a className="inline-link" href="#/studio">
                  Create an offer ↗
                </a>
              </div>
            </div>
            <aside
              className="plan-panel panel"
              aria-label="Selected offer details"
            >
              {detailError ? (
                <>
                  <h3>We couldn’t load this offer.</h3>
                  <p role="alert">{detailError}</p>
                  <button onClick={bump}>Retry</button>
                </>
              ) : !plan ? (
                <p role="status">Checking the offer’s terms…</p>
              ) : (
                <>
                  <div className="panel-kicker">
                    <Tag tone="green">
                      {config.mode === "demo"
                        ? "Ready to try locally"
                        : "Signed manifest verified"}
                    </Tag>
                    <span>↗</span>
                  </div>
                  <h2>{plan.manifest.name}</h2>
                  <p>{plan.manifest.description}</p>
                  <dl className="terms-grid">
                    <div>
                      <dt>ONE PASS</dt>
                      <dd>
                        {price(plan.manifest.priceAtomic)}{" "}
                        <small>
                          {config.mode === "demo" ? "demo" : "test"} USDC
                        </small>
                      </dd>
                    </div>
                    <div>
                      <dt>YOURS FOR</dt>
                      <dd>{duration(plan.manifest.durationSeconds)}</dd>
                    </div>
                    <div>
                      <dt>RATE LIMIT</dt>
                      <dd>
                        {plan.manifest.limits.requestsPerMinute}
                        <small> calls / min</small>
                      </dd>
                    </div>
                    <div>
                      <dt>IN PARALLEL</dt>
                      <dd>
                        {plan.manifest.limits.concurrency}
                        <small> requests</small>
                      </dd>
                    </div>
                  </dl>
                  <div className="included">
                    <span>✓</span> One payment covers the whole window.
                    <br />
                    <span>✓</span> The clock starts when your pass activates.
                  </div>
                  <button
                    className="button full"
                    disabled={!!busy || !config.ready.checkout}
                    onClick={() => void checkout()}
                  >
                    {pending && subject
                      ? "Resume your purchase"
                      : !config.ready.checkout
                        ? "Checkout not configured"
                        : config.mode === "demo"
                          ? "Try this API"
                          : "Get this pass"}{" "}
                    <span>↗</span>
                  </button>
                  <p className="fine-print centered">
                    {config.mode === "demo"
                      ? "No real funds. No wallet required."
                      : "Paid in USDC on Avalanche Fuji testnet."}
                  </p>
                  <details>
                    <summary>Terms & provenance</summary>
                    <p>{plan.manifest.terms}</p>
                    <p>
                      Provider <code>{short(plan.manifest.provider)}</code>
                    </p>
                    <p>
                      Manifest{" "}
                      <code className="break">{plan.listing.manifestRef}</code>
                    </p>
                    <p>
                      Maximum input:{" "}
                      {Math.round(plan.manifest.limits.bodyBytes / 1024)} KB.
                      Timeout: {plan.manifest.limits.timeoutMs / 1000}s.
                      Platform fee: {plan.manifest.feeBps / 100}% of the listed
                      price.
                    </p>
                  </details>
                </>
              )}
            </aside>
          </div>
        )}
      </section>
      <section className="how-it-works">
        <div>
          <span>01 / FIND YOUR FIT</span>
          <h3>A menu, not a maze.</h3>
          <p>Useful tools. Clear terms. Pick what fits your next idea.</p>
        </div>
        <div>
          <span>02 / TAKE YOUR TIME</span>
          <h3>Pay once. Get to work.</h3>
          <p>
            Your pass opens a window of access, with the limits shown upfront.
          </p>
        </div>
        <div>
          <span>03 / KEEP THE GOOD STUFF</span>
          <h3>Leave with a receipt.</h3>
          <p>When time is up, export a signed record of your session.</p>
        </div>
      </section>
    </>
  );
}
