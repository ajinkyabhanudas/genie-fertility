import { describe, it, expect, beforeEach } from 'vitest';
import { writeAuditEntry, verifyAuditChain, type AuditEntryInput } from './auditLog';

// In-memory stand-in for the audit_log table — exercises the hash-chain
// logic (writeAuditEntry, verifyAuditChain) without a real Postgres instance.
function makeFakeClient() {
  const rows: any[] = [];
  let nextId = 1;

  const client = {
    query: async (sql: string, params: any[] = []) => {
      if (sql.includes('SELECT row_hash FROM audit_log')) {
        const last = rows[rows.length - 1];
        return { rows: last ? [{ row_hash: last.row_hash }] : [] };
      }

      if (sql.startsWith('INSERT INTO audit_log')) {
        const [
          created_at, who, query, country, adjacency, retrieved_chunks, model,
          prompt_hash, output_hash, retrieval_state, embedding_mode, outcome,
          prev_hash, row_hash,
        ] = params;
        rows.push({
          id: nextId++,
          created_at,
          who,
          query,
          country,
          adjacency,
          retrieved_chunks: JSON.parse(retrieved_chunks),
          model,
          prompt_hash,
          output_hash,
          retrieval_state,
          embedding_mode,
          outcome,
          prev_hash,
          row_hash,
        });
        return { rows: [] };
      }

      if (sql.includes('FROM audit_log ORDER BY id ASC')) {
        return { rows: [...rows] };
      }

      throw new Error(`Unexpected query in fake client: ${sql}`);
    },
  } as any;

  return { client, rows };
}

const baseEntry: AuditEntryInput = {
  who: 'test-client',
  query: 'endometriosis biomarkers UK',
  country: 'UK',
  adjacency: 'endometriosis',
  retrievedChunks: [{ chunkId: 'pmc-1', sourceUrl: 'https://europepmc.org/article/MED/1' }],
  model: 'gemini-3-flash-preview',
  promptHash: 'abc123',
  outputHash: 'def456',
  retrievalState: 'grounded',
  embeddingMode: 'semantic',
  outcome: 'success',
};

describe('writeAuditEntry + verifyAuditChain', () => {
  let fake: ReturnType<typeof makeFakeClient>;

  beforeEach(() => {
    fake = makeFakeClient();
  });

  it('writes a row with prev_hash pointing to the genesis hash for the first entry', async () => {
    await writeAuditEntry(fake.client, baseEntry);

    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0].prev_hash).toBe('0'.repeat(64));
    expect(fake.rows[0].row_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('chains each row to the previous row_hash', async () => {
    await writeAuditEntry(fake.client, baseEntry);
    await writeAuditEntry(fake.client, { ...baseEntry, query: 'second query' });

    expect(fake.rows[1].prev_hash).toBe(fake.rows[0].row_hash);
  });

  it('verifies a clean, untampered chain as valid', async () => {
    await writeAuditEntry(fake.client, baseEntry);
    await writeAuditEntry(fake.client, { ...baseEntry, query: 'second query' });
    await writeAuditEntry(fake.client, { ...baseEntry, query: 'third query' });

    const result = await verifyAuditChain(fake.client);

    expect(result.valid).toBe(true);
  });

  it('detects tampering when a row content field is modified after the fact', async () => {
    await writeAuditEntry(fake.client, baseEntry);
    await writeAuditEntry(fake.client, { ...baseEntry, query: 'second query' });

    // Simulate an attacker editing row 1's query without recomputing hashes.
    fake.rows[0].query = 'tampered query';

    const result = await verifyAuditChain(fake.client);

    expect(result.valid).toBe(false);
    expect(result.brokenAtId).toBe(1);
  });

  it('detects tampering when a row is deleted, breaking the chain link', async () => {
    await writeAuditEntry(fake.client, baseEntry);
    await writeAuditEntry(fake.client, { ...baseEntry, query: 'second query' });
    await writeAuditEntry(fake.client, { ...baseEntry, query: 'third query' });

    // Simulate deleting the middle row — the last row's prev_hash no longer
    // matches the (now first) row's row_hash.
    fake.rows.splice(1, 1);

    const result = await verifyAuditChain(fake.client);

    expect(result.valid).toBe(false);
  });

  it('verifies an empty chain as valid (no rows written yet)', async () => {
    const result = await verifyAuditChain(fake.client);
    expect(result.valid).toBe(true);
  });
});
