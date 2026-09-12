/**
 * Call a service you bought, from the terminal, exactly like a machine would.
 *
 *   bun tools/call-service.ts <serviceId> "<passKey>.<secret>" [operation] [inputJson] [appUrl]
 *
 * Example:
 *   bun tools/call-service.ts market-api-08c1 "0xabc….0xdef…" getQuote '{"symbol":"BTC"}'
 *
 * The API key (passKey.secret) is shown on the service page after buying and on
 * /passes ("Copy"). The app verifies on Arkiv that the pass exists, is for this
 * service, is not expired, and that keccak256(secret) matches its secret_hash.
 */
import { getServiceByEnsName } from "@apiritivo/arkiv";
import { ENS_SERVICE_TEXT_KEY, normalizeEnsName, resolveServiceRecords } from "@apiritivo/ens";

let [serviceId, apiKey, operation = "getQuote", inputJson = '{"symbol":"BTC"}', appUrl = process.env.APP_URL ?? "http://localhost:3000"] = process.argv.slice(2);

if (!serviceId || !apiKey) {
  console.error('usage: bun tools/call-service.ts <serviceId | name.eth> "<passKey>.<secret>" [operation] [inputJson] [appUrl]');
  process.exit(2);
}

// A `.eth` name works like a service id: ENS text record first, Arkiv `ens_name` attribute as fallback.
const ensName = serviceId.endsWith(".eth") ? normalizeEnsName(serviceId) : null;
if (serviceId.endsWith(".eth") && !ensName) {
  console.error(`${serviceId} is not a valid ENS name.`);
  process.exit(2);
}
if (ensName) {
  const records = await resolveServiceRecords(ensName);
  if (records.serviceId) {
    console.log(`ENS ${ensName} → ${ENS_SERVICE_TEXT_KEY} = ${records.serviceId}${records.manifestRef ? ` · contenthash bzz://${records.manifestRef.slice(0, 12)}…` : ""}`);
    serviceId = records.serviceId;
  } else {
    const svc = await getServiceByEnsName(ensName);
    if (!svc) {
      console.error(`${ensName} has no ${ENS_SERVICE_TEXT_KEY} record and no Arkiv service links it.`);
      process.exit(2);
    }
    console.log(`ENS ${ensName} → Arkiv ens_name → ${svc.serviceId} (text record not set yet)`);
    serviceId = svc.serviceId;
  }
}
if (!/^0x[0-9a-fA-F]{64}\.0x[0-9a-fA-F]{64}$/.test(apiKey)) {
  console.error("API key must look like <passKey>.<secret> (two 0x + 64 hex values joined by a dot).");
  process.exit(2);
}

let input: unknown;
try {
  input = JSON.parse(inputJson);
} catch {
  console.error("inputJson is not valid JSON:", inputJson);
  process.exit(2);
}

const url = `${appUrl.replace(/\/+$/, "")}/api/gateway/${serviceId}`;
console.log(`POST ${url}\n  operation=${operation} input=${JSON.stringify(input)}\n`);
const started = Date.now();
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
  body: JSON.stringify({ operation, input }),
});
const json = (await res.json().catch(() => ({}))) as {
  ok?: boolean;
  error?: string;
  result?: unknown;
  verification?: { secondsRemaining?: number; expiresAtBlock?: string };
  upstream?: string;
};
console.log(`HTTP ${res.status} in ${Date.now() - started} ms`);
if (json.verification)
  console.log(
    `pass verified on Arkiv ✓  expires in ${json.verification.secondsRemaining ?? "?"} s (block ${json.verification.expiresAtBlock ?? "?"})  upstream=${json.upstream ?? "-"}`,
  );
if (json.error) console.log(`error: ${json.error}`);
console.log(JSON.stringify(json.result ?? json, null, 2));
process.exit(res.ok ? 0 : 1);
