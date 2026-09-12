import { useEffect, useState } from "react";
import type { Hex } from "viem";
import {
  api,
  download,
  duration,
  price,
  saved,
  short,
  type Pass,
} from "./api.ts";
import { Empty, Tag, useApp } from "./App.tsx";

type Archive = { purchaseId: string; name: string; reference: string };
export function Passes() {
  const {
    subject,
    config,
    requireLogin,
    busy,
    run,
    pending,
    setPending,
    refresh,
    bump,
    notify,
    client,
  } = useApp();
  const [passes, setPasses] = useState<Pass[]>([]),
    [selected, setSelected] = useState<string>(),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(Date.now()),
    [hash, setHash] = useState(""),
    [archives, setArchives] = useState<Archive[]>([]),
    [restore, setRestore] = useState("");
  const vaultKey = `apiperitivo.vault.${config.mode}.${subject}`;
  useEffect(() => {
    setArchives(saved<Archive[]>(vaultKey) ?? []);
  }, [vaultKey]);
  useEffect(() => {
    if (!subject) return;
    let active = true,
      running = false;
    const load = async () => {
      if (running || !active) return;
      running = true;
      try {
        const data = await api<{ passes: Pass[] }>("/passes");
        if (active) {
          setPasses(data.passes.reverse());
          setSelected((old) =>
            data.passes.some((p) => p.purchaseId === old)
              ? old
              : data.passes[0]?.purchaseId,
          );
          setLoadError("");
        }
      } catch (e) {
        if (active) setLoadError((e as Error).message);
      } finally {
        running = false;
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [subject, refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function resume() {
    if (!pending) return;
    await run("Resuming your purchase…", async () => {
      const { sendCall, waitForTransaction } = await import("./wallet.ts");
      let value = pending;
      if (!value.txHash) {
        if (config.mode === "demo")
          value = {
            ...value,
            ...(await api<{ txHash: Hex }>("/demo/pay", {
              purchaseIntentId: value.prepared.purchaseIntentId,
            })),
          };
        else if (value.purchaseRequested) {
          if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
            throw new Error(
              "Paste the purchase transaction hash from your wallet to resume safely.",
            );
          value = { ...value, txHash: hash as Hex };
        } else {
          await waitForTransaction(
            await sendCall(value.prepared.approve, value.payer),
          );
          value = { ...value, purchaseRequested: true };
          setPending(value);
          value = {
            ...value,
            txHash: await sendCall(value.prepared.purchase, value.payer),
          };
        }
        setPending(value);
      }
      if (config.mode !== "demo") await waitForTransaction(value.txHash!);
      const result = await api<Pass>("/purchases/confirm", {
        purchaseIntentId: value.prepared.purchaseIntentId,
        txHash: value.txHash,
      });
      setPending(undefined);
      setSelected(result.purchaseId);
      bump();
      notify("Payment recorded. Your pass is being activated.");
    });
  }
  async function archive(pass: Pass) {
    const connection = client?.connect();
    await run("Encrypting and saving your receipt…", async () => {
      await connection;
      if (!client) throw new Error("Connect Swarm ID to archive your receipt.");
      const { swarmIdentity, savePrivateReceipt } = await import(
        "../../../packages/swarm/src/browser.ts"
      );
      if ((await swarmIdentity(client)).subject !== subject)
        throw new Error("Connect the Swarm identity that owns this session.");
      const receipt = await api(`/purchases/${pass.purchaseId}/receipt`, {});
      const result = await savePrivateReceipt(client, receipt);
      const entry = {
        purchaseId: pass.purchaseId,
        name: pass.manifest.name,
        reference: result.reference,
      };
      // Export the reference as well: clearing browser storage must not silently lose the only pointer.
      download(`apiritivo-swarm-${short(pass.purchaseId)}.json`, entry);
      const updated = [
        ...archives.filter((a) => a.purchaseId !== pass.purchaseId),
        entry,
      ];
      localStorage.setItem(vaultKey, JSON.stringify(updated));
      setArchives(updated);
      notify(
        "Receipt encrypted, uploaded, and read back successfully. Keep the downloaded reference backup.",
      );
    });
  }
  async function restoreReceipt(reference: string) {
    const connection = client?.connect();
    await run("Opening your private receipt…", async () => {
      await connection;
      if (!client)
        throw new Error("Swarm ID is not available. Reload and reconnect.");
      const { swarmIdentity, readPrivateReceipt } = await import(
        "../../../packages/swarm/src/browser.ts"
      );
      if ((await swarmIdentity(client)).subject !== subject)
        throw new Error("Connect the Swarm identity that owns this session.");
      download(
        "apiritivo-receipt.json",
        await readPrivateReceipt(client, reference),
      );
      notify("Receipt verified and downloaded.");
    });
  }
  if (!subject)
    return (
      <Empty title="Your next session starts here.">
        <p>
          Sign in to collect your passes, run API tools, and keep your receipts.
        </p>
        <button className="button" onClick={() => requireLogin("passes")}>
          Sign in to see your passes ↗
        </button>
      </Empty>
    );
  const current = passes.find((p) => p.purchaseId === selected);
  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR TABLE</p>
          <h1>
            Time well <em>spent.</em>
          </h1>
          <p className="lead">
            Your passes, your tools, and a little room to experiment.
          </p>
        </div>
        <a href="#/explore" className="button secondary">
          Explore the menu ↗
        </a>
      </div>
      {pending && (
        <div className="recovery panel">
          <Tag tone="orange">Purchase in progress</Tag>
          <h3>Let’s finish where you left off.</h3>
          <p>
            {pending.txHash
              ? "Your transaction hash is saved. Resume to verify the same payment and activate your pass."
              : pending.purchaseRequested
                ? "Check your wallet’s activity. If a purchase was sent, paste its hash below. This avoids sending a second payment."
                : "Your purchase is prepared. Continue when you’re ready."}
          </p>
          {pending.txHash && (
            <p className="break">
              <code>{pending.txHash}</code>
            </p>
          )}
          {!pending.txHash && pending.purchaseRequested && (
            <label>
              Purchase transaction hash
              <input
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="0x…"
              />
            </label>
          )}
          <div className="button-row">
            <button
              className="button"
              disabled={!!busy}
              onClick={() => void resume()}
            >
              Resume purchase →
            </button>
            {!pending.txHash && (
              <button
                className="text-button"
                disabled={!!busy}
                onClick={() => {
                  if (
                    !pending.purchaseRequested ||
                    window.confirm(
                      "Only discard this intent if your wallet confirms that no purchase transaction was sent. If a transaction exists, cancel and recover it using its hash.",
                    )
                  ) {
                    download("apiritivo-purchase-recovery.json", pending);
                    setPending(undefined);
                  }
                }}
              >
                Discard {pending.purchaseRequested ? "unsent" : "prepared"}{" "}
                purchase
              </button>
            )}
          </div>
        </div>
      )}
      {loadError && (
        <div className="notice error" role="alert">
          {loadError}
          <button onClick={bump} className="text-button">
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Checking your passes…</p>
      ) : !passes.length ? (
        <Empty title="Nothing poured just yet.">
          <p>
            Choose an API from the menu. Your active pass and playground will
            appear here.
          </p>
          <a className="button" href="#/explore">
            Find your first API ↗
          </a>
        </Empty>
      ) : (
        <div className="passes-layout">
          <div className="pass-list" aria-label="Your passes">
            {passes.map((p) => (
              <button
                key={p.purchaseId}
                className={`pass-item ${p.purchaseId === selected ? "selected" : ""}`}
                aria-pressed={p.purchaseId === selected}
                onClick={() => setSelected(p.purchaseId)}
              >
                <div>
                  <Tag tone={p.access === "active" ? "green" : ""}>
                    {p.status === "manual_review" ? "Needs review" : p.access}
                  </Tag>
                  <span>{duration(p.manifest.durationSeconds)}</span>
                </div>
                <h3>{p.manifest.name}</h3>
                <p>
                  {price(p.manifest.priceAtomic)}{" "}
                  {config.mode === "demo" ? "demo" : "test"} USDC{" "}
                  <span>· {short(p.purchaseId)}</span>
                </p>
              </button>
            ))}
          </div>
          {current && (
            <Playground
              key={current.purchaseId}
              pass={current}
              now={now}
              verificationUnavailable={!!loadError}
              onArchive={() => void archive(current)}
            />
          )}
        </div>
      )}
      {config.mode === "testnet" && (
        <details className="vault panel">
          <summary>
            Your private receipt archive{" "}
            {archives.length > 0 && `(${archives.length})`}
          </summary>
          <p>
            Receipts are encrypted with your Swarm identity. References are
            saved in this browser and in your downloaded backup.
          </p>
          {archives.map((a) => (
            <div className="archive-row" key={a.purchaseId}>
              <span>
                {a.name} <code>{short(a.reference)}</code>
              </span>
              <button
                className="text-button"
                disabled={!!busy || !client}
                onClick={() => void restoreReceipt(a.reference)}
              >
                Download receipt ↓
              </button>
            </div>
          ))}
          {archives.length > 0 && (
            <button
              className="button secondary"
              onClick={() =>
                download("apiritivo-vault-references.json", archives)
              }
            >
              Back up all references ↓
            </button>
          )}
          <label>
            Recover a receipt using a saved Swarm reference
            <input
              placeholder="64-character Swarm reference"
              value={restore}
              onChange={(e) => setRestore(e.target.value.trim())}
            />
          </label>
          <button
            className="button secondary"
            disabled={
              !!busy || !client || !/^(0x)?[a-fA-F0-9]{64}$/.test(restore)
            }
            onClick={() => void restoreReceipt(restore)}
          >
            Open saved receipt
          </button>
        </details>
      )}
    </section>
  );
}
function Playground({
  pass,
  now,
  onArchive,
  verificationUnavailable,
}: {
  pass: Pass;
  now: number;
  onArchive: () => void;
  verificationUnavailable: boolean;
}) {
  const { config, busy, run, notify, bump, client } = useApp();
  const [operation, setOperation] = useState(pass.manifest.operations[0]),
    [input, setInput] = useState(
      "Good ideas deserve great ingredients. Good APIs make a great start.",
    ),
    [records, setRecords] = useState(
      '[\n  { "name": "Spritz", "category": "text", "price": 0.1 },\n  { "name": "Tonic", "category": "data", "price": 0.1 }\n]',
    ),
    [fields, setFields] = useState("name, price");
  const [output, setOutput] = useState<unknown>(),
    [credential, setCredential] = useState<{ id: string; token: string }>();
  const remaining = Math.max(
    0,
    Math.ceil((pass.remainingSeconds ?? 0) - (now - pass.checkedAt) / 1000),
  );
  const active =
    pass.access === "active" && remaining > 0 && !verificationUnavailable;
  const countdown = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  return (
    <div className="playground panel">
      <div className="playground-heading">
        <div>
          <p className="eyebrow">YOUR API PLAYGROUND</p>
          <h2>{pass.manifest.name}</h2>
        </div>
        <div className={`countdown ${!active ? "muted" : ""}`}>
          <span>
            {active
              ? "APPROX. TIME LEFT"
              : pass.access === "expired"
                ? "SESSION COMPLETE"
                : "PASS STATUS"}
          </span>
          <strong>
            {active
              ? countdown
              : verificationUnavailable
                ? "Unavailable"
                : pass.status === "manual_review"
                  ? "Needs review"
                  : pass.access === "active"
                    ? "Checking…"
                    : pass.access}
          </strong>
        </div>
      </div>
      <p>
        {active
          ? "Make a request. Your gateway checks access every time."
          : pass.access === "expired"
            ? "That’s a wrap. New calls are blocked, and your final receipt is ready."
            : pass.status === "manual_review"
              ? "Activation needs operator review. Your payment is recorded; do not purchase again to retry this activation."
              : "Access is verified before each request. Your payment remains recorded while activation is pending."}
      </p>
      {pass.lastError && (
        <p className="fine-print">
          Activation status: {pass.lastError.replaceAll("_", " ").toLowerCase()}
          .
        </p>
      )}
      <div className="progress-track" aria-hidden="true">
        <span
          style={{
            width: `${Math.min(100, (remaining / pass.manifest.durationSeconds) * 100)}%`,
          }}
        />
      </div>
      {pass.manifest.operations.length > 1 && (
        <label>
          Operation
          <select
            value={operation}
            onChange={(e) => {
              setOperation(e.target.value as typeof operation);
              setOutput(undefined);
            }}
          >
            {pass.manifest.operations.map((op) => (
              <option key={op}>{op}</option>
            ))}
          </select>
        </label>
      )}
      <div className="code-label">
        <span>
          {operation === "text.analyze" ? "YOUR TEXT" : "YOUR JSON RECORDS"}
        </span>
        <code>{operation}</code>
      </div>
      {operation === "text.analyze" ? (
        <textarea
          aria-label="Text to analyze"
          rows={6}
          maxLength={30000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      ) : (
        <>
          <textarea
            className="code-input"
            aria-label="JSON records"
            rows={7}
            value={records}
            onChange={(e) => setRecords(e.target.value)}
          />
          <label>
            Fields to keep <span className="muted">(separated by commas)</span>
            <input value={fields} onChange={(e) => setFields(e.target.value)} />
          </label>
        </>
      )}
      <div className="button-row">
        <button
          className="button"
          disabled={!!busy || !active}
          onClick={() =>
            void run("Running your request…", async () => {
              let body: unknown = { text: input };
              if (operation === "json.transform") {
                try {
                  body = {
                    records: JSON.parse(records),
                    select: fields
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  };
                } catch {
                  throw new Error(
                    "Your records need to be valid JSON. Check the commas and quotation marks.",
                  );
                }
              }
              const result = await api<{ data: unknown }>(
                `/passes/${pass.purchaseId}/invoke/${operation}`,
                body,
              );
              setOutput(result.data);
              bump();
            })
          }
        >
          Run {operation === "text.analyze" ? "analysis" : "transformation"}{" "}
          <span>↗</span>
        </button>
        <span className="fine-print">
          Up to {pass.manifest.limits.requestsPerMinute} calls / min
        </span>
      </div>
      {output !== undefined && (
        <div className="result">
          <div className="code-label">
            <span>
              <span className="status-dot" /> RESPONSE · SUCCESS
            </span>
            <button
              className="text-button"
              onClick={() => download("apiritivo-result.json", output)}
            >
              Export JSON ↓
            </button>
          </div>
          <pre tabIndex={0}>{JSON.stringify(output, null, 2)}</pre>
        </div>
      )}
      {pass.access === "expired" && (
        <div className="receipt-block">
          <div>
            <Tag>Session complete</Tag>
            <h3>Keep a little proof.</h3>
            <p>
              Your signed receipt includes the payment, access window and usage
              counts.
            </p>
          </div>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={!!busy || !config.ready.receipts}
              onClick={() =>
                void run("Preparing your final receipt…", async () => {
                  download(
                    `apiritivo-receipt-${short(pass.purchaseId)}.json`,
                    await api(`/purchases/${pass.purchaseId}/receipt`, {}),
                  );
                  notify("Your signed receipt has been downloaded.");
                })
              }
            >
              Download receipt ↓
            </button>
            {config.mode === "testnet" && (
              <button
                className="button secondary"
                disabled={!!busy || !client || !config.ready.receipts}
                onClick={onArchive}
              >
                Save privately to Swarm ↗
              </button>
            )}
            <a className="inline-link" href="#/explore">
              Pick a new pass →
            </a>
          </div>
          {config.mode === "demo" && (
            <p className="fine-print">
              Local demo receipt. Swarm archiving is available in configured
              testnet mode.
            </p>
          )}
        </div>
      )}
      <details className="developer-access">
        <summary>Use this pass from your code</summary>
        <p>
          Create a credential scoped to this pass and operation. Every request
          still checks the pass expiry. Keep the token private.
        </p>
        {!credential ? (
          <button
            className="button secondary"
            disabled={!!busy || !active}
            onClick={() =>
              void run("Creating a scoped credential…", async () => {
                setCredential(
                  await api(`/passes/${pass.purchaseId}/credentials`, {
                    operations: [operation],
                    ttlSeconds: 300,
                  }),
                );
              })
            }
          >
            Create temporary credential
          </button>
        ) : (
          <>
            <pre
              tabIndex={0}
            >{`curl '${location.origin}/api/passes/${pass.purchaseId}/invoke/${operation}' \\\n  -H 'Authorization: Bearer ${credential.token}' \\\n  -H 'Content-Type: application/json' \\\n  --data '${operation === "text.analyze" ? '{"text":"Hello, APIritivo!"}' : '{"records":[{"name":"Spritz"}],"select":["name"]}'}`}</pre>
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() =>
                void run("Revoking credential…", async () => {
                  await api(
                    `/credentials/${credential.id}`,
                    undefined,
                    "DELETE",
                  );
                  setCredential(undefined);
                  notify("Credential revoked.");
                })
              }
            >
              Revoke this credential
            </button>
          </>
        )}
      </details>
      <details>
        <summary>Session details</summary>
        <p className="break">
          Purchase <code>{pass.purchaseId}</code>
        </p>
        <p className="break">
          Payment <code>{pass.payment.txHash}</code>
        </p>
        {pass.activation && (
          <p>
            Access blocks: {pass.activation.createdAtBlock} →{" "}
            {pass.activation.expiresAtBlock}. The displayed timer is an
            estimate; the gateway uses Arkiv’s current block.
          </p>
        )}
      </details>
    </div>
  );
}
