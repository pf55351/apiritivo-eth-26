"use client";

import { ARKIV_DATA_EXPLORER_URL, ARKIV_EXPLORER_URL } from "@apiritivo/arkiv";
import { EXPLORER_URL, explorerAddressUrl, explorerTokenUrl, paymentsContractAddress, USDC_ADDRESS } from "@apiritivo/payments";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { CodePanel } from "@/components/code-panel";
import { Badge, Button, Disclosure, SectionTitle } from "@/components/ui";
import { publicEnv } from "@/lib/env";

const SECTIONS = [
  ["overview", "Overview"],
  ["flow", "How it works"],
  ["pass", "Access pass"],
  ["private", "Private files"],
  ["data", "Data on Arkiv"],
  ["api", "API"],
  ["run", "Run it"],
  ["judge", "Judge walkthrough"],
  ["code", "Code map"],
] as const;

const WRITER = "0x401629d4c1A4C1A0Ffd14A089f798Dd29A94c09C";
const DATA_EXPLORER = `${ARKIV_DATA_EXPLORER_URL}/?chain=tiramisu`;

/** Native disclosures keep reference material available without a wall of text. */
function openSection(id: string) {
  const details = document.getElementById(id)?.querySelector("details");
  if (details) details.open = true;
}

/** Deployed origin for copy-ready examples; localhost only until hydration. */
function useOrigin(): string {
  const [origin, setOrigin] = useState("http://localhost:3000");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
}

function Section({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-36">
      <details className="ui-disclosure" open={id === "overview"}>
        <summary>
          <h2 id={`${id}-title`} className="text-xl font-medium text-content">
            {title}
          </h2>
          <span className="disclosure-chevron" aria-hidden="true">
            ⌄
          </span>
        </summary>
        <div className="pb-8 pt-2">
          {lead ? <p className="max-w-2xl text-sm leading-relaxed text-muted">{lead}</p> : null}
          <div className="mt-6 space-y-6">{children}</div>
        </div>
      </details>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: [string, ...ReactNode[]][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-surface text-xs text-subtle">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r[0]} className="align-top">
              {head.map((h, j) => (
                <td key={h} className={`px-4 py-2.5 ${j === 0 ? "whitespace-nowrap font-mono text-xs text-accent-text" : "text-muted"}`}>
                  {r[j]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-content underline decoration-line-strong underline-offset-4 hover:decoration-accent">
      {children}
    </a>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-xs text-content">{children}</code>;
}

function Steps({ items }: { items: { title: string; body: ReactNode; expect?: ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {items.map((s, i) => (
        <li key={s.title} className="grid gap-3 py-3 sm:grid-cols-[24px_minmax(0,1fr)]">
          <span className="font-mono text-xs text-subtle">{String(i + 1)}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{s.title}</p>
            <div className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</div>
            {s.expect ? <p className="mt-2 text-xs text-accent-text">Expect · {s.expect}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

const SECTION_IDS = SECTIONS.map(([id]) => id);

export default function DocsPage() {
  const contract = paymentsContractAddress();
  const origin = useOrigin();
  useEffect(() => {
    const revealHash = () => {
      const id = window.location.hash.slice(1);
      if (SECTION_IDS.includes(id as (typeof SECTION_IDS)[number])) openSection(id);
    };
    revealHash();
    window.addEventListener("hashchange", revealHash);
    return () => window.removeEventListener("hashchange", revealHash);
  }, []);
  const gateway = publicEnv.swarmGatewayUrl.replace(/\/+$/, "");

  const layers: { name: string; role: string; link: string; href: string }[] = [
    { name: "Swarm ID", role: "Identity, wallet, and credential recovery.", link: "swarm-id.snaha.net", href: publicEnv.swarmIframeOrigin },
    { name: "Swarm", role: "API manifests and encrypted private files.", link: "public gateway", href: gateway },
    { name: "Arkiv", role: "Listings, access passes, receipts, and grants.", link: "data explorer", href: DATA_EXPLORER },
    {
      name: "Avalanche Fuji",
      role: "USDC payments, verified before access is issued.",
      link: contract ? "contract on explorer" : "USDC on explorer",
      href: contract ? explorerAddressUrl(contract) : explorerTokenUrl(),
    },
  ];

  return (
    <div id="top">
      <SectionTitle title="Documentation" description="Start here. Open a topic for details." right={<Badge tone="accent">Testnet edition</Badge>} />

      <div className="mt-10 grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
        <aside>
          <nav aria-label="Documentation sections" className="flex flex-wrap gap-x-5 lg:sticky lg:top-28 lg:flex-col">
            {SECTIONS.map(([id, name]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => openSection(id)}
                className="flex min-h-11 items-center py-2 text-sm text-subtle underline decoration-transparent underline-offset-4 hover:text-content hover:decoration-white"
              >
                {name}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <Section id="overview" title="Overview" lead="Providers publish APIs. Clients buy timed access with USDC and call APIs using an API key for each pass.">
            <div className="grid gap-4 sm:grid-cols-2">
              {layers.map((l) => (
                <div key={l.name} className="min-w-0 py-3">
                  <p className="text-sm font-medium">{l.name}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{l.role}</p>
                  <a href={l.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-accent-text hover:text-content">
                    {l.link} ↗
                  </a>
                </div>
              ))}
            </div>
            <Disclosure title="Network references">
              <Table
                head={["Address", "What", "Where"]}
                rows={[
                  [
                    contract ?? "not deployed",
                    "APIritivoPayments · fee 0 · owner = Arkiv writer",
                    contract ? (
                      <Ext key="c" href={explorerAddressUrl(contract)}>
                        explorer
                      </Ext>
                    ) : (
                      "set NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS"
                    ),
                  ],
                  [
                    USDC_ADDRESS,
                    "USDC · Circle testnet · 6 decimals",
                    <Ext key="u" href={explorerTokenUrl()}>
                      explorer
                    </Ext>,
                  ],
                  [
                    WRITER,
                    "Arkiv writer · signs every entity · pays GLM gas",
                    <Ext key="w" href={`${ARKIV_EXPLORER_URL}/address/${WRITER}`}>
                      explorer
                    </Ext>,
                  ],
                ]}
              />
            </Disclosure>
          </Section>

          <Section id="flow" title="How it works" lead="Publish a listing, purchase access, then call the API.">
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                {
                  t: "Publish",
                  who: "provider",
                  s: [
                    "form → manifest (operations, typed inputs)",
                    "uploadData → Swarm → manifestRef",
                    "optional private file → ACT upload",
                    "POST /api/services → Arkiv service entity",
                  ],
                },
                {
                  t: "Buy",
                  who: "client",
                  s: [
                    "approve USDC → buy() on the contract",
                    "server verifies the Purchased event",
                    "browser generates a pass secret",
                    "POST /api/access-passes → access_pass + sale on Arkiv",
                  ],
                },
                {
                  t: "Call",
                  who: "client or agent",
                  s: [
                    "Authorization: Bearer <passKey>.<secret>",
                    "gateway reads the pass on Arkiv",
                    "checks service, expiry, keccak(secret)",
                    "forwards or answers with the demo bot",
                  ],
                },
              ].map((f) => (
                <div key={f.t} className="min-w-0 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{f.t}</p>
                    <span className="text-xs text-subtle">{f.who}</span>
                  </div>
                  <ol className="mt-3 space-y-1.5 text-sm text-muted">
                    {f.s.map((x, i) => (
                      <li key={x} className="flex gap-2">
                        <span className="font-mono text-[10px] text-subtle">{i + 1}</span>
                        <span className="min-w-0">{x}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </Section>

          <Section id="pass" title="Access pass" lead="Your API key combines a public pass ID with a private secret. Access ends when the pass expires.">
            <Table
              head={["Piece", "Where", "Who can read it"]}
              rows={[
                ["passKey", "Arkiv entity key", "everyone (explorer)"],
                ["secret", "generated in the buyer's browser", "buyer only"],
                ["secret_hash", "Arkiv attribute · keccak256(secret)", "everyone · useless without the secret"],
                ["encryptedSecret", "Arkiv payload · AES-256-GCM under a key derived from the buyer's Swarm ID", "buyer, on any device"],
                ["API key", "<passKey>.<secret>", "whoever the buyer gives it to, until expiry"],
              ]}
            />
            <CodePanel
              title="call.sh"
              language="BASH"
              code={`# copy the API key from the service page or /passes
bun call:service <serviceId> "<passKey>.<secret>" getQuote '{"symbol":"BTC"}'

curl -s ${origin}/api/gateway/<serviceId> \\
  -H 'authorization: Bearer <passKey>.<secret>' \\
  -H 'content-type: application/json' \\
  -d '{"operation":"getQuote","input":{"symbol":"BTC"}}'`}
              footer={<span>The server never sees the secret at mint time. Verification is one Arkiv read plus one hash.</span>}
            />
            <Table
              head={["Request", "Response"]}
              rows={[
                ["no header", "401 · Missing access pass"],
                ["passKey only", "401 · Missing pass secret"],
                ["wrong secret", "403 · Pass secret does not match this pass"],
                ["other service", "403 · This pass is for a different service"],
                ["after expiry", "403 · Access pass not found on Arkiv or expired"],
                ["valid", "200 · result + verification (block, seconds left)"],
              ]}
            />
          </Section>

          <Section id="private" title="Private files" lead="Providers can include one encrypted file, up to 512 KB. Buyers need a separate grant from the provider to download it.">
            <Steps
              items={[
                {
                  title: "Publish with a file",
                  body: (
                    <>
                      Open Private file in the publish form. <Mono>actUploadData</Mono> with an empty grantee list. Arkiv stores name, size, type and the three ACT references.
                    </>
                  ),
                },
                {
                  title: "Buyer purchases",
                  body: (
                    <>
                      The pass and the sale record the buyer&apos;s Swarm sharing key (<Mono>buyer_pubkey</Mono>).
                    </>
                  ),
                },
                {
                  title: "Provider grants",
                  body: (
                    <>
                      My APIs, File access, Grant access. <Mono>actAddGrantees</Mono> runs in the provider&apos;s browser; <Mono>POST /api/grants</Mono> records the new history
                      reference as a <Mono>grant</Mono> entity.
                    </>
                  ),
                },
                {
                  title: "Buyer downloads",
                  body: (
                    <>
                      Service page, &quot;Private file&quot;, Download. <Mono>actDownloadData</Mono> decrypts with the buyer&apos;s own Swarm ID. No shared key ever travels.
                    </>
                  ),
                  expect: "the file opens; a non-granted identity gets a decryption error",
                },
              ]}
            />
          </Section>

          <Section id="data" title="Data on Arkiv" lead="Listings and receipts are public. Pass secrets and private files stay encrypted.">
            <Table
              head={["Entity", "Attributes", "Payload", "Lifetime"]}
              rows={[
                [
                  "service",
                  "app, entity_type, service_id, category, provider_id, provider_name, available, version, manifest_ref, price_usdc, access_seconds, payout_address (+ private_* when a file is attached)",
                  "name, description",
                  "permanent",
                ],
                [
                  "access_pass",
                  "service_id, provider_id, buyer_id, buyer_address, buyer_pubkey, tx_hash, paid_usdc, chain_id, secret_hash",
                  "serviceName, purchasedAt, encryptedSecret",
                  "expires after access_seconds",
                ],
                ["sale", "same as the pass minus secret_hash, plus pass_key", "serviceName, purchasedAt", "permanent"],
                ["grant", "service_id, provider_id, buyer_id, buyer_pubkey, act_history_ref, act_enc_ref, act_pubkey", "grantedAt", "permanent"],
              ]}
            />
            <CodePanel
              title="data-explorer.txt"
              language="TEXT"
              code={`one entity          $key = key(0x<entity key>)
all app entities    $owner = addr(${WRITER})
open                ${DATA_EXPLORER}`}
            />
          </Section>

          <Section id="api" title="API" lead="Six endpoints. Payments and pass secrets are verified before access is granted.">
            <Table
              head={["Route", "Does", "Trust"]}
              rows={[
                ["POST /api/services", "creates the service entity (after the manifest is on Swarm)", "providerId from the client is trusted"],
                [
                  "POST /api/access-passes",
                  "verifies the Fuji payment (Purchased event or USDC transfer), refuses reused tx hashes, mints access_pass + sale",
                  "buyer must be the payer",
                ],
                ["POST /api/grants", "records an ACT grant made in the provider's browser", "providerId must own the service"],
                ["POST /api/bot/[serviceId]", "demo bot behind a pass · getQuote returns a live price", "pass + secret verified on Arkiv"],
                ["POST /api/gateway/[serviceId]", "verifies the pass, forwards to the provider endpoint or answers with the bot", "pass + secret verified on Arkiv"],
                ["GET /api/services", "writer health: address, GLM balance, funded", "public"],
              ]}
            />
          </Section>

          <Section id="run" title="Run it" lead="Bun 1.3+, Node.js 20+, and test funds on Avalanche Fuji. Foundry is optional for contract tests.">
            <CodePanel
              title="run.sh"
              language="BASH"
              code={`git clone https://github.com/pf55351/apiritivo-eth-26 && cd apiritivo-eth-26
bun install
cp .env.example apps/web/.env.local   # writer key, gateways, contract address pre-filled
bun demo:check                        # must end with READY
bun dev                               # http://localhost:3000

bun typecheck && bun lint && bun test # TypeScript, ESLint, unit tests
bun test:contracts                    # Foundry tests
bun run build                         # stop bun dev first: both write apps/web/.next`}
            />
            <Table
              head={["Faucet", "For", "Link"]}
              rows={[
                [
                  "GLM · Arkiv",
                  `the app writer ${WRITER.slice(0, 8)}… (only if "writer unfunded" appears)`,
                  <Ext key="g" href="https://hub.arkiv.network/faucet">
                    hub.arkiv.network/faucet
                  </Ext>,
                ],
                [
                  "AVAX · Fuji",
                  "gas for the buyer (approve + buy) and for a provider claim",
                  <Ext key="a" href="https://core.app/tools/testnet-faucet/">
                    core.app testnet faucet
                  </Ext>,
                ],
                [
                  "USDC · Fuji",
                  "the buyer's Swarm wallet (0.50 per pass; the faucet gives 10)",
                  <Ext key="c" href="https://faucet.circle.com/">
                    faucet.circle.com
                  </Ext>,
                ],
              ]}
            />
          </Section>

          <Section id="judge" title="Judge walkthrough" lead="Use separate browser profiles for Provider and Client. Each purchase needs test USDC and AVAX for gas.">
            <Steps
              items={[
                {
                  title: "Run the app",
                  body: (
                    <>
                      Commands above. <Mono>bun demo:check</Mono> ends with READY. Open <Mono>http://localhost:3000</Mono>.
                    </>
                  ),
                  expect: "home page with Enter with Swarm ID",
                },
                {
                  title: "Create the provider identity",
                  body: (
                    <>
                      Enter with Swarm ID, click the button in the dialog, create a new identity in the popup, then choose Provider. On{" "}
                      <Link href="/provider" className="underline">
                        My APIs
                      </Link>
                      , open Connection details to check storage and the Arkiv writer.
                    </>
                  ),
                  expect: "Storage ready and a funded writer",
                },
                {
                  title: "Publish an API",
                  body: (
                    <>
                      Publish a service: name, category, price 0.50 USDC, duration 1 hour, one operation <Mono>getQuote(symbol: string)</Mono>. Payout wallet is your Swarm wallet,
                      fixed. Optionally attach a small private file.
                    </>
                  ),
                  expect: "success screen with Swarm gateway, Arkiv entity and transaction links; open both",
                },
                {
                  title: "Create and fund the buyer",
                  body: (
                    <>
                      Second profile or private window: new identity, choose Client, open the service from the marketplace, open Fund wallet and copy your address, fund it with
                      AVAX and USDC from the faucets, click refresh.
                    </>
                  ),
                  expect: "USDC ≥ 0.50 and some AVAX",
                },
                {
                  title: "Buy access",
                  body: <>Buy access · 0.50 USDC. Approve, buy() on the contract, confirmation, mint on Arkiv. Two Fuji transactions signed by the Swarm wallet in the browser.</>,
                  expect: "Active access with expiry, Use API, and a payment receipt",
                },
                {
                  title: "Call the API",
                  body: (
                    <>
                      Try API: <Mono>getQuote</Mono>, <Mono>BTC</Mono>. From a terminal:{" "}
                      <Mono>bun call:service &lt;serviceId&gt; &quot;&lt;passKey&gt;.&lt;secret&gt;&quot; getQuote &apos;&#123;&quot;symbol&quot;:&quot;ETH&quot;&#125;&apos;</Mono>
                      . See Access pass for error responses.
                    </>
                  ),
                  expect: "Pass verified on Arkiv with expiry block, a live price, 401/403 on every negative check",
                },
                {
                  title: "Private file (optional)",
                  body: <>My APIs, File access, Grant access for the buyer. Buyer: service page, Private file, Download.</>,
                  expect: "the file decrypts for the granted buyer only",
                },
                {
                  title: "See the sale",
                  body: <>My APIs: recorded sales and revenue update. Open Sales receipts for pass and payment links.</>,
                  expect: "the sale receipt opens in the Arkiv data explorer",
                },
                {
                  title: "Claim the money",
                  body: (
                    <>
                      Send a little AVAX to the provider&apos;s Swarm wallet. In Wallet, select Claim USDC. Optional: withdraw USDC to any address, reveal the private key for
                      MetaMask.
                    </>
                  ),
                  expect: "USDC balance goes up, claim tx on the explorer",
                },
                {
                  title: "Verify without the app",
                  body: (
                    <>
                      Arkiv data explorer with <Mono>$owner = addr({WRITER.slice(0, 10)}…)</Mono>; the contract&apos;s Purchased and Claimed events on{" "}
                      <Ext href={`${EXPLORER_URL}/address/${contract ?? ""}`}>the explorer</Ext>; manifest bytes at <Mono>{gateway}/bytes/&lt;manifest_ref&gt;</Mono>.
                    </>
                  ),
                  expect: "every entity, event and byte reachable outside APIritivo",
                },
              ]}
            />
            <Table
              head={["Symptom", "Fix"]}
              rows={[
                ["popup does not open", "allow popups for this site, retry from the sign in dialog; Brave: use the button inside the dialog"],
                ["Arkiv writer unfunded", `faucet GLM to ${WRITER.slice(0, 10)}…, refresh`],
                ["Swarm upload unavailable", "the app falls back to a direct gateway upload"],
                ["Buy button disabled", "USDC or AVAX still 0: wait for the faucet, click refresh"],
                ["marketplace empty", "Tiramisu is a testnet and may have been reset: publish again"],
                ["Cannot find module .next/…", "stop bun dev, delete apps/web/.next, start one bun dev"],
                ["changed .env.local", "restart bun dev: NEXT_PUBLIC_* is inlined at start"],
              ]}
            />
          </Section>

          <Section id="code" title="Code map" lead="SDK integrations live in packages. The web app uses shared types and adapters.">
            <Table
              head={["Path", "What"]}
              rows={[
                ["packages/swarm/src/index.ts", "Swarm ID login, manifest upload/download, wallet + key derivation, drive, ACT private files"],
                ["packages/arkiv/src/index.ts", "typed Arkiv queries, block timing, verifyAccessPass, explorer links"],
                ["packages/arkiv/src/pass-secret.ts", "pass secret: keccak on-chain, AES-GCM for the buyer, bearer format"],
                ["packages/arkiv/src/server.ts", "publishService, issueAccessPass, publishGrant: the only writes"],
                ["packages/payments/src/server.ts", "verifyPayment: Purchased event or USDC Transfer, pure receipt checks"],
                ["packages/payments/src/browser.ts", "Swarm wallet signer, pay, claim, watchSales live feed"],
                ["contracts/src/APIritivoPayments.sol", "buy / claim ledger, Foundry tests"],
                ["apps/web/app/api/*", "services, access-passes, grants, bot, gateway"],
                ["tools/", "demo-check, call-service"],
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <Button href="https://github.com/pf55351/apiritivo-eth-26" variant="ghost">
                Repository ↗
              </Button>
              <Button href="/design-system" variant="ghost">
                UI library
              </Button>
              <Button href="/">Open app</Button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
