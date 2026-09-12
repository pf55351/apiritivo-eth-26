import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SwarmIdClient } from "@snaha/swarm-id";
import type { Hex } from "viem";
import type {
  identityFromSeed,
  Challenge,
} from "../../../packages/auth/src/proof.ts";
import { api, type Config, type Pending, saved, short } from "./api.ts";
import { Catalog } from "./Catalog.tsx";
const Passes = lazy(() =>
  import("./Passes.tsx").then((m) => ({ default: m.Passes })),
);
const Studio = lazy(() =>
  import("./Studio.tsx").then((m) => ({ default: m.Studio })),
);

type Page = "explore" | "passes" | "studio" | "sign-in";
type Context = {
  config: Config;
  subject?: Hex;
  name: string;
  go: (page: Page) => void;
  requireLogin: (next: Page) => boolean;
  run: (label: string, task: () => Promise<void>) => Promise<void>;
  busy: string;
  client?: SwarmIdClient;
  pending?: Pending;
  setPending: (value?: Pending) => void;
  refresh: number;
  bump: () => void;
  notify: (message: string) => void;
};
const AppContext = createContext<Context>(null!);
export const useApp = () => useContext(AppContext);
const readPage = (): Page => {
  const value = location.hash.replace("#/", "");
  return ["explore", "passes", "studio", "sign-in"].includes(value)
    ? (value as Page)
    : "explore";
};
export function Mark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "mark small" : "mark"}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        d="M10 14h28L24 32zm14 18v10m-8 0h16M33 5l-7 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="29" cy="18" r="3.2" fill="currentColor" />
    </svg>
  );
}
export function Tag({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Mark />
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function App() {
  const [config, setConfig] = useState<Config>(),
    [subject, setSubject] = useState<Hex>(),
    [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>(readPage),
    [next, setNext] = useState<Page>("explore");
  const [name, setName] = useState(
      () => sessionStorage.getItem("apiperitivo.name") ?? "Guest",
    ),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [client, setClient] = useState<SwarmIdClient>(),
    [refresh, setRefresh] = useState(0),
    [pending, updatePending] = useState<Pending>();
  useEffect(() => {
    const listener = () => {
      setPage(readPage());
      setError("");
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    addEventListener("hashchange", listener);
    return () => removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    const listener = () => setSubject(undefined);
    addEventListener("session-expired", listener);
    return () => removeEventListener("session-expired", listener);
  }, []);
  useEffect(() => {
    void (async () => {
      try {
        setConfig(await api<Config>("/config"));
        try {
          setSubject((await api<{ subject: Hex }>("/auth/session")).subject);
        } catch {
          /* A guest session is expected. */
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    if (!config || config.mode === "demo") return;
    let cancelled = false,
      instance: SwarmIdClient | undefined;
    void import("@snaha/swarm-id")
      .then(async ({ SwarmIdClient }) => {
        instance = new SwarmIdClient({
          iframeOrigin: config.swarmIdUrl,
          metadata: {
            name: "APIperitivo",
            description: "Timed access to useful APIs",
          },
        });
        await instance.initialize();
        if (!cancelled) setClient(instance);
      })
      .catch(() => {
        if (!cancelled)
          setNotice(
            "Swarm ID is unavailable. Check your connection and reload before signing in.",
          );
      });
    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [config]);
  useEffect(() => {
    updatePending(
      subject
        ? saved<Pending>(`apiperitivo.pending.${config?.mode}.${subject}`)
        : undefined,
    );
  }, [subject, config]);
  function setPending(value?: Pending) {
    if (!subject) throw new Error("Sign in before starting a purchase.");
    const key = `apiperitivo.pending.${config!.mode}.${subject}`;
    // Persistence must succeed before requesting a wallet transaction.
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
    updatePending(value);
  }
  function go(target: Page) {
    location.hash = `/${target}`;
    setPage(target);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function run(label: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      const value = e as Error & { shortMessage?: string };
      setError(
        value.shortMessage ??
          value.message ??
          "Something went wrong. Please retry.",
      );
    } finally {
      setBusy("");
    }
  }
  async function login() {
    // connect opens its popup synchronously from this click, before awaiting other work.
    const connection =
      config!.mode === "testnet" ? client!.connect() : undefined;
    await run("Signing in…", async () => {
      let identity: ReturnType<typeof identityFromSeed>;
      if (config!.mode === "demo") {
        const { bytesToHex, hexToBytes } = await import("viem");
        const { identityFromSeed } = await import(
          "../../../packages/auth/src/proof.ts"
        );
        let seed = sessionStorage.getItem(
          "apiperitivo.demo-identity",
        ) as Hex | null;
        if (!seed) {
          seed = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
          sessionStorage.setItem("apiperitivo.demo-identity", seed);
        }
        identity = identityFromSeed(hexToBytes(seed));
      } else {
        await connection;
        const { swarmIdentity } = await import(
          "../../../packages/swarm/src/browser.ts"
        );
        identity = await swarmIdentity(client!);
      }
      const challenge = await api<Challenge>("/auth/challenge", {
        publicKey: identity.publicKey,
      });
      if (
        challenge.audience !== location.origin ||
        challenge.expiresAt <= Date.now()
      )
        throw new Error(
          "The login challenge has the wrong origin or has expired.",
        );
      const session = await api<{ subject: Hex }>("/auth/verify", {
        challengeId: challenge.id,
        signature: identity.signChallenge(challenge),
      });
      const displayName =
        config!.mode === "demo"
          ? name.trim() === "Guest"
            ? "Demo guest"
            : name.trim() || "Demo guest"
          : (client!.connectionInfo.identity?.name ?? "Swarm member");
      setName(displayName);
      sessionStorage.setItem("apiperitivo.name", displayName);
      setSubject(session.subject);
      go(next);
      setNotice(`Welcome, ${displayName}. Your table is ready.`);
    });
  }
  const context: Context | undefined = config && {
    config,
    subject,
    name,
    go,
    busy,
    client,
    run,
    pending,
    setPending,
    refresh,
    bump: () => setRefresh((v) => v + 1),
    notify: setNotice,
    requireLogin: (target) => {
      if (subject) return true;
      setNext(target);
      go("sign-in");
      return false;
    },
  };
  if (loading)
    return (
      <main className="fatal">
        <Mark />
        <p>Setting your table…</p>
      </main>
    );
  if (!context)
    return (
      <main className="fatal">
        <h1>We couldn’t open the menu.</h1>
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </main>
    );
  return (
    <AppContext.Provider value={context}>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="mode-bar">
        <span className="status-dot" />
        {config!.mode === "demo" ? (
          <>
            <strong>Local demo</strong>
            <span>
              Payments & storage are simulated. The API tools really run.
            </span>
          </>
        ) : (
          <>
            <strong>Testnet edition</strong>
            <span>Fuji USDC · Arkiv · Swarm</span>
          </>
        )}
      </div>
      <header className="site-header wrap">
        <a className="brand" href="#/explore" aria-label="APIperitivo home">
          <Mark small />
          <span>
            API<span className="brand-serif">peritivo</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {(["explore", "passes", "studio"] as const).map((p, i) => (
            <a
              key={p}
              href={`#/${p}`}
              aria-current={page === p ? "page" : undefined}
            >
              {["Explore APIs", "My passes", "Create an offer"][i]}
            </a>
          ))}
        </nav>
        {subject ? (
          <div className="account">
            <span title={subject}>
              <span className="avatar">{name[0]?.toUpperCase()}</span>
              <span className="account-name">{name}</span>
            </span>
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() =>
                void run("Signing out…", async () => {
                  await api("/auth/session", undefined, "DELETE");
                  setSubject(undefined);
                  go("explore");
                  await client?.disconnect().catch(() => {});
                })
              }
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            className="button secondary compact"
            onClick={() => {
              setNext(page === "sign-in" ? "explore" : page);
              go("sign-in");
            }}
          >
            Sign in <span aria-hidden="true">↗</span>
          </button>
        )}
      </header>
      <main id="main" className="wrap" tabIndex={-1}>
        {error && (
          <div className="notice error" role="alert">
            <span>{error}</span>
            <button
              className="text-button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
        {notice && (
          <div className="notice success" role="status">
            <span>{notice}</span>
            <button
              className="text-button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
        {busy && (
          <div className="working" role="status">
            <span className="spinner" />
            {busy}
          </div>
        )}
        {page === "explore" && <Catalog />}
        <Suspense
          fallback={
            <p className="workspace" role="status">
              Opening your workspace…
            </p>
          }
        >
          {page === "passes" && <Passes />}
          {page === "studio" && <Studio />}
        </Suspense>
        {page === "sign-in" && (
          <section className="login-layout">
            <div>
              <p className="eyebrow">YOUR TABLE IS WAITING</p>
              <h1>
                A little time.
                <br />A lot of <em>possibility.</em>
              </h1>
              <p className="lead">
                One identity to discover APIs, pick a pass, and make something
                good.
              </p>
              <div className="login-note">
                <Mark />
                <p>
                  No monthly commitment.
                  <br />
                  Just what you need, for the time you need it.
                </p>
              </div>
            </div>
            <div className="panel login-panel">
              <Tag tone="green">
                {config!.mode === "demo"
                  ? "Try it in a minute"
                  : "Your identity, your control"}
              </Tag>
              <h2>Make yourself at home.</h2>
              <p>
                {config!.mode === "demo"
                  ? "Create a local demo identity. No wallet, tokens, or account setup needed."
                  : "Connect Swarm ID to securely prove your identity. You’ll connect an Ethereum wallet separately when you buy a pass."}
              </p>
              {config!.mode === "demo" && (
                <label>
                  What should we call you?
                  <input
                    autoComplete="nickname"
                    maxLength={40}
                    value={name === "Guest" ? "" : name}
                    placeholder="Your name"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              <button
                className="button full"
                disabled={!!busy || (config!.mode === "testnet" && !client)}
                onClick={() => void login()}
              >
                {config!.mode === "demo"
                  ? "Enter the demo"
                  : client
                    ? "Continue with Swarm ID"
                    : "Connecting to Swarm ID…"}{" "}
                <span>↗</span>
              </button>
              <p className="fine-print">
                {config!.mode === "demo"
                  ? "Your demo identity stays in this browser tab. Local records persist on this machine. Use testnet mode for a portable Swarm identity."
                  : "A signed login proof is verified by the gateway. Your identity secret stays in your browser."}
              </p>
              <a href="#/explore" className="inline-link">
                Just browsing? Explore the menu →
              </a>
            </div>
          </section>
        )}
      </main>
      <footer className="wrap site-footer">
        <span className="footer-brand">Good APIs. No long-term strings.</span>
        <span>
          Made for the moment <span className="orange">✳</span> APIperitivo
        </span>
        <span>
          {config!.mode === "demo"
            ? "Local rehearsal · ETHRome"
            : "Fuji testnet · ETHRome"}
        </span>
      </footer>
    </AppContext.Provider>
  );
}
