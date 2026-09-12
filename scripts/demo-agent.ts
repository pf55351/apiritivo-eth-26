// A scoped bearer credential comes from POST /api/passes/:purchaseId/credentials.
const { API_BASE_URL = 'http://localhost:3001', AGENT_TOKEN, PURCHASE_ID } = process.env;
if (!AGENT_TOKEN || !/^0x[0-9a-fA-F]{64}$/.test(PURCHASE_ID ?? '')) throw new Error('Set AGENT_TOKEN and PURCHASE_ID to an existing paid pass');
const response = await fetch(`${API_BASE_URL}/api/passes/${PURCHASE_ID}/invoke/text.analyze`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AGENT_TOKEN}` },
  body: JSON.stringify({ text: 'An aperitivo for APIs. Pay for time, use your API, let access expire.' }), signal: AbortSignal.timeout(30000),
});
console.log(JSON.stringify({ status: response.status, result: await response.json() }, null, 2));
process.exitCode = response.ok ? 0 : 1;
export {};
