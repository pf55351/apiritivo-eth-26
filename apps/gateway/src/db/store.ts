import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppError, type Intent, type Purchase, type SignedTransaction } from '../../../../packages/domain/src/index.ts';
import type { Challenge } from '../../../../packages/auth/src/proof.ts';
import type { Hex } from 'viem';

export const randomToken = () => randomBytes(32).toString('hex');
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(readFileSync(new URL('./migrations/001-initial.sql', import.meta.url), 'utf8'));
  }
  close() { this.db.close(); }
  private document<T>(sql: string, ...params: string[]): T | undefined {
    const row = this.db.prepare(sql).get(...params) as { document: string } | undefined;
    return row ? JSON.parse(row.document) as T : undefined;
  }
  challenge(challenge: Challenge) {
    this.db.prepare('DELETE FROM challenges WHERE expires_at <= ?').run(Date.now());
    this.db.prepare('INSERT INTO challenges VALUES (?, ?, ?)').run(challenge.id, JSON.stringify(challenge), challenge.expiresAt);
  }
  getChallenge(id: string) { return this.document<Challenge>('SELECT document FROM challenges WHERE id = ?', id); }
  consumeChallenge(id: string, now: number) { return this.db.prepare('DELETE FROM challenges WHERE id = ? AND expires_at > ?').run(id, now).changes === 1; }
  createSession(subject: Hex, now = Date.now()) {
    const token = randomToken();
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(tokenHash(token), subject, now + 86400_000);
    return token;
  }
  session(token: string, now = Date.now()): Hex | undefined {
    return (this.db.prepare('SELECT subject FROM sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash(token), now) as { subject: Hex } | undefined)?.subject;
  }
  logout(token: string) { this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token)); }
  putIntent(intent: Intent) { this.db.prepare('INSERT INTO intents VALUES (?, ?, ?)').run(intent.id, intent.subject, JSON.stringify(intent)); }
  getIntent(id: string) { return this.document<Intent>('SELECT document FROM intents WHERE id = ?', id); }
  getPurchase(id: string) { return this.document<Purchase>('SELECT document FROM purchases WHERE id = ?', id); }
  purchaseForIntent(id: string) { return this.document<Purchase>('SELECT document FROM purchases WHERE intent_id = ?', id); }
  putPurchase(p: Purchase) {
    this.db.prepare('INSERT OR IGNORE INTO purchases VALUES (?, ?, ?, ?, ?)').run(p.payment.purchaseId, p.intent.id, p.intent.subject, p.payment.txHash, JSON.stringify(p));
    const stored = this.purchaseForIntent(p.intent.id)!;
    if (stored.payment.txHash !== p.payment.txHash || stored.payment.purchaseId !== p.payment.purchaseId) throw new AppError('PURCHASE_MISMATCH', 409);
    return stored;
  }
  updatePurchase(p: Purchase) { this.db.prepare('UPDATE purchases SET document = ? WHERE id = ?').run(JSON.stringify(p), p.payment.purchaseId); }
  purchases(subject?: Hex): Purchase[] {
    const rows = subject ? this.db.prepare('SELECT document FROM purchases WHERE subject = ?').all(subject) : this.db.prepare('SELECT document FROM purchases').all();
    return rows.map(row => JSON.parse(row.document as string));
  }
  captureTransaction(id: Hex, signed: SignedTransaction) {
    const p = this.getPurchase(id)!;
    if (p.signedTransaction && p.signedTransaction.hash !== signed.hash) throw new AppError('ACTIVATION_ALREADY_SUBMITTED', 409);
    p.signedTransaction = signed; p.status = 'submitting'; this.updatePurchase(p);
  }
  createCredential(subject: Hex, purchase: Hex, operations: string[], expiresAt: number) {
    const token = randomToken(), id = randomUUID();
    this.db.prepare('INSERT INTO credentials VALUES (?, ?, ?, ?, ?, ?)').run(id, tokenHash(token), subject, purchase, JSON.stringify(operations), expiresAt);
    return { id, token, expiresAt };
  }
  credential(token: string, now = Date.now()): { subject: Hex; purchaseId: Hex; operations: string[] } | undefined {
    const row = this.db.prepare('SELECT subject, purchase_id, operations FROM credentials WHERE token_hash = ? AND expires_at > ?').get(tokenHash(token), now);
    return row ? { subject: row.subject as Hex, purchaseId: row.purchase_id as Hex, operations: JSON.parse(row.operations as string) } : undefined;
  }
  revokeCredential(id: string, subject: Hex) { this.db.prepare('DELETE FROM credentials WHERE id = ? AND subject = ?').run(id, subject); }
  // No await between checking limits and reserving a slot; atomic across SQLite writers.
  admit(purchase: Hex, operation: string, rpm: number, concurrency: number, now = Date.now()) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.db.prepare('SELECT 1 FROM closed_passes WHERE purchase_id = ?').get(purchase)) throw new AppError('ACCESS_EXPIRED', 403);
      const row = this.db.prepare('SELECT COUNT(*) AS recent, SUM(CASE WHEN finished_at IS NULL THEN 1 ELSE 0 END) AS inflight FROM usage_events WHERE purchase_id = ? AND (admitted_at > ? OR finished_at IS NULL)').get(purchase, now - 60000)!;
      if (Number(row.recent) >= rpm || Number(row.inflight) >= concurrency) throw new AppError('RATE_LIMITED', 429);
      const id = randomUUID(); this.db.prepare('INSERT INTO usage_events VALUES (?, ?, ?, ?, NULL, NULL)').run(id, purchase, operation, now);
      this.db.exec('COMMIT'); return id;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  finishUsage(id: string, outcome: string) { this.db.prepare('UPDATE usage_events SET finished_at = ?, outcome = ? WHERE id = ? AND finished_at IS NULL').run(Date.now(), outcome, id); }
  recoverInterruptedUsage() { this.db.prepare("UPDATE usage_events SET finished_at = ?, outcome = 'interrupted' WHERE finished_at IS NULL").run(Date.now()); }
  usage(purchase: Hex) {
    return this.db.prepare("SELECT COUNT(*) AS admitted, COALESCE(SUM(CASE WHEN finished_at IS NULL THEN 1 ELSE 0 END), 0) AS inflight, COALESCE(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END), 0) AS succeeded FROM usage_events WHERE purchase_id = ?").get(purchase) as { admitted: number; inflight: number; succeeded: number };
  }
  receipt(purchase: Hex) { return this.document<unknown>('SELECT document FROM receipts WHERE purchase_id = ?', purchase); }
  closeAdmissions(purchase: Hex) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.usage(purchase).inflight > 0) throw new AppError('RECEIPT_NOT_FINAL', 409);
      this.db.prepare('INSERT OR IGNORE INTO closed_passes VALUES (?)').run(purchase);
      const usage = this.usage(purchase);
      this.db.exec('COMMIT'); return usage;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  putReceipt(purchase: Hex, receipt: unknown) { this.db.prepare('INSERT OR IGNORE INTO receipts (purchase_id, document) VALUES (?, ?)').run(purchase, JSON.stringify(receipt)); }
  receiptReference(purchase: Hex, ref: Hex) { this.db.prepare('UPDATE receipts SET reference = ? WHERE purchase_id = ?').run(ref, purchase); }
}
