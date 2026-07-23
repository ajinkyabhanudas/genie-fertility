/**
 * @file auditLog.ts
 * @description Append-only, hash-chained audit log. Every generation writes
 * one row here — {who, when, query, country, adjacency, retrieved chunk
 * ids+source urls, model, prompt hash, output hash, retrievalState,
 * embeddingMode}. Hash-chaining (each row's hash covers its own content plus
 * the previous row's hash) makes tampering detectable: recomputing the chain
 * from row 1 must reproduce every stored row_hash exactly.
 */

import crypto from 'crypto';
import type { PoolClient } from 'pg';

export interface AuditEntryInput {
  who: string;
  query: string;
  country?: string;
  adjacency?: string;
  retrievedChunks: Array<{ chunkId: string; sourceUrl: string }>;
  model: string;
  promptHash: string;
  outputHash: string;
  retrievalState: string;
  embeddingMode: string;
  outcome: 'success' | 'cache_hit' | 'error';
}

function computeRowHash(prevHash: string, entry: AuditEntryInput, createdAt: string): string {
  const payload = JSON.stringify({ prevHash, entry, createdAt });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

const GENESIS_HASH = '0'.repeat(64);

/**
 * Writes one audit row within an existing transaction (`client` must be a
 * connected PoolClient with a BEGIN already issued by the caller). The
 * caller is responsible for commit/rollback — this function only inserts.
 */
export async function writeAuditEntry(client: PoolClient, entry: AuditEntryInput): Promise<void> {
  const prevResult = await client.query(
    'SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1 FOR UPDATE'
  );
  const prevHash = prevResult.rows[0]?.row_hash ?? GENESIS_HASH;
  const createdAt = new Date().toISOString();
  const rowHash = computeRowHash(prevHash, entry, createdAt);

  await client.query(
    `INSERT INTO audit_log
      (created_at, who, query, country, adjacency, retrieved_chunks, model,
       prompt_hash, output_hash, retrieval_state, embedding_mode, outcome,
       prev_hash, row_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      createdAt,
      entry.who,
      entry.query,
      entry.country ?? null,
      entry.adjacency ?? null,
      JSON.stringify(entry.retrievedChunks),
      entry.model,
      entry.promptHash,
      entry.outputHash,
      entry.retrievalState,
      entry.embeddingMode,
      entry.outcome,
      prevHash,
      rowHash,
    ]
  );
}

/**
 * Verifies the full hash chain. Returns true if every row's stored row_hash
 * matches the recomputed hash of (prevHash + entry content + createdAt).
 * A single tampered row breaks verification for every row after it.
 */
export async function verifyAuditChain(client: PoolClient): Promise<{ valid: boolean; brokenAtId?: number }> {
  const result = await client.query(
    `SELECT id, created_at, who, query, country, adjacency, retrieved_chunks,
            model, prompt_hash, output_hash, retrieval_state, embedding_mode,
            outcome, prev_hash, row_hash
     FROM audit_log ORDER BY id ASC`
  );

  let expectedPrevHash = GENESIS_HASH;

  for (const row of result.rows) {
    const entry: AuditEntryInput = {
      who: row.who,
      query: row.query,
      country: row.country ?? undefined,
      adjacency: row.adjacency ?? undefined,
      retrievedChunks: row.retrieved_chunks,
      model: row.model,
      promptHash: row.prompt_hash,
      outputHash: row.output_hash,
      retrievalState: row.retrieval_state,
      embeddingMode: row.embedding_mode,
      outcome: row.outcome,
    };

    if (row.prev_hash !== expectedPrevHash) {
      return { valid: false, brokenAtId: row.id };
    }

    const createdAt = new Date(row.created_at).toISOString();
    const recomputed = computeRowHash(row.prev_hash, entry, createdAt);

    if (recomputed !== row.row_hash) {
      return { valid: false, brokenAtId: row.id };
    }

    expectedPrevHash = row.row_hash;
  }

  return { valid: true };
}
