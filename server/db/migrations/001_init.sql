-- SP-2: BFF persistence seam. Provisions the tables SP-2 owns and the
-- document_chunks vector table SP-3 will fill (embeddings stay empty here).

CREATE EXTENSION IF NOT EXISTS vector;

-- Append-only, hash-chained audit log. Every generation writes one row here
-- in the same transaction as the response — no result without a record.
-- Hash-chaining (prev_hash + this row's content hash) makes tampering
-- detectable: recomputing the chain from row 1 must match every stored hash.
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    who             TEXT NOT NULL,
    query           TEXT NOT NULL,
    country         TEXT,
    adjacency       TEXT,
    retrieved_chunks JSONB NOT NULL DEFAULT '[]', -- [{chunkId, sourceUrl}]
    model           TEXT NOT NULL,
    prompt_hash     TEXT NOT NULL,
    output_hash     TEXT NOT NULL,
    retrieval_state TEXT NOT NULL,
    embedding_mode  TEXT NOT NULL,
    outcome         TEXT NOT NULL, -- success | cache_hit | error
    prev_hash       TEXT NOT NULL,
    row_hash        TEXT NOT NULL
);

CREATE INDEX idx_audit_log_created_at_id ON audit_log (created_at, id);

-- Cache for external source-registry responses (Europe PMC / ClinicalTrials
-- / openFDA). Bypasses network on hit; pruned on schedule, not per-request.
CREATE TABLE source_cache (
    cache_key       TEXT PRIMARY KEY, -- connector name + normalized params
    connector       TEXT NOT NULL,
    response_body   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_source_cache_expires_at ON source_cache (expires_at);

-- Cache for full generation responses, keyed by the request fingerprint.
-- A cache hit skips both the provider call and a new audit_log insert
-- (the original row already covers it) — see auditLog.ts logCacheHit().
CREATE TABLE generation_cache (
    cache_key       TEXT PRIMARY KEY, -- sha256(query+country+adjacency+model+promptHash)
    response_text   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_generation_cache_expires_at ON generation_cache (expires_at);

-- Vector store SP-3 fills. Provisioned here so the seam exists; SP-2 does
-- not populate embeddings or query this table.
CREATE TABLE document_chunks (
    id              TEXT PRIMARY KEY,
    ref_tag         TEXT NOT NULL,
    title           TEXT NOT NULL,
    abstract        TEXT,
    text            TEXT NOT NULL,
    source          TEXT NOT NULL,
    source_name     TEXT NOT NULL,
    url             TEXT,
    doi             TEXT,
    pmid            TEXT,
    nct_id          TEXT,
    publication_date TEXT,
    authors         TEXT[],
    embedding       vector(768),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
