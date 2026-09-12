import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { createPublicClient, createTestClient, createWalletClient, erc20Abi, http, parseEther, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { FUJI_USDC, namedId, type Intent } from '../packages/domain/src/index.ts';
import { accessMarketAbi } from '../packages/avalanche/src/abi.ts';
import { FujiMarket } from '../packages/avalanche/src/client.ts';
import { sampleManifests } from './sample-manifests.ts';

// Isolated local EVM: no Fuji transactions, no sponsor-write evidence.
const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
const port = (reservation.address() as { port: number }).port; await new Promise<void>(resolve => reservation.close(() => resolve()));
const anvil = spawn('anvil', ['--port', String(port), '--host', '127.0.0.1', '--chain-id', '43113', '--silent'], { stdio: 'ignore' });
let startError: Error | undefined; anvil.on('error', error => { startError = error; });
const transport = http(`http://127.0.0.1:${port}`, { retryCount: 0, timeout: 1000 });
const client = createPublicClient({ chain: avalancheFuji, transport, cacheTime: 0 });
const test = createTestClient({ chain: avalancheFuji, mode: 'anvil', transport });
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (startError) throw startError;
    if (anvil.exitCode !== null) throw new Error('Anvil could not start');
    try { ready = await client.getChainId() === 43113; if (ready) break; } catch { /* starting */ }
    await delay(100);
  }
  if (!ready) throw new Error('Anvil startup timed out');
  const account = privateKeyToAccount(generatePrivateKey());
  await test.setBalance({ address: account.address, value: parseEther('10') });
  const wallet = createWalletClient({ account, chain: avalancheFuji, transport });
  const tokenArtifact = JSON.parse(await readFile('contracts/out/AccessMarket.t.sol/TestUSDC.json', 'utf8'));
  const deployedToken = await client.waitForTransactionReceipt({ hash: await wallet.deployContract({ abi: tokenArtifact.abi, bytecode: tokenArtifact.bytecode.object }) });
  // Install the test token code at the public Fuji address inside this disposable local chain.
  await test.setCode({ address: FUJI_USDC, bytecode: (await client.getCode({ address: deployedToken.contractAddress! }))! });
  await client.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: FUJI_USDC, abi: tokenArtifact.abi, functionName: 'mint', args: [account.address, 1000000n] }) });
  const artifact = JSON.parse(await readFile('contracts/out/AccessMarket.sol/AccessMarket.json', 'utf8'));
  const deployed = await client.waitForTransactionReceipt({ hash: await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object, args: [FUJI_USDC, account.address] }) });
  const address = deployed.contractAddress!;
  const provider = '0x1111111111111111111111111111111111111111', treasury = '0x2222222222222222222222222222222222222222';
  const [manifest] = sampleManifests(provider, treasury), ref = namedId('local-test-content');
  await client.waitForTransactionReceipt({ hash: await wallet.writeContract({ address, abi: accessMarketAbi, functionName: 'registerPlan', args: [manifest.planId, {
    serviceId: manifest.serviceId, manifestRef: ref, provider, treasury, priceAtomic: 100000n, durationSeconds: 60, feeBps: 1000, active: true,
  }] }) });
  const market = new FujiMarket(`http://127.0.0.1:${port}`, address, 2);
  assert.equal((await market.getPlan(manifest.planId)).priceAtomic, '100000');
  const intent: Intent = { id: namedId('local-intent'), subject: namedId('local-subject'), payer: account.address.toLowerCase() as Hex, planId: manifest.planId, manifestRef: ref, createdAt: Date.now() };
  await client.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: FUJI_USDC, abi: erc20Abi, functionName: 'approve', args: [address, 100000n] }) });
  const txHash = await wallet.writeContract({ address, abi: accessMarketAbi, functionName: 'purchase', args: [intent.planId, intent.id, intent.subject] });
  await client.waitForTransactionReceipt({ hash: txHash }); await test.mine({ blocks: 1 });
  const payment = await market.verifyPayment(intent, txHash, manifest);
  assert.equal(payment.txHash, txHash);
  assert.equal(await client.readContract({ address: FUJI_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [provider] }), 90000n);
  assert.equal(await client.readContract({ address: FUJI_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [treasury] }), 10000n);
  await assert.rejects(() => market.verifyPayment({ ...intent, subject: namedId('wrong') }, txHash, manifest), /PURCHASE_MISMATCH/);
  console.log('PASS: real Solidity deployment, USDC split and Fuji adapter verification on isolated Anvil. No testnet writes.');
} finally { anvil.kill('SIGTERM'); if (anvil.exitCode === null) await once(anvil, 'exit'); }
