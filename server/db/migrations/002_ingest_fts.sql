-- SP-3.1: adds the columns the ingest pipeline needs that 001_init.sql's
-- provisioned document_chunks table doesn't yet have — content_hash (drives
-- idempotent re-ingest: unchanged chunks are skipped, never re-embedded) and
-- an FTS tsvector (SP-3.2 queries this for real BM25/ts_rank scoring, not the
-- per-query regex counter it replaces).

ALTER TABLE document_chunks
    ADD COLUMN content_hash TEXT,
    ADD COLUMN fts_vector tsvector;

CREATE INDEX idx_document_chunks_fts ON document_chunks USING GIN (fts_vector);

-- content_hash drives the idempotency gate — every ingested row must carry
-- one so re-ingestion can detect "unchanged" without recomputing an embedding.
ALTER TABLE document_chunks
    ALTER COLUMN content_hash SET NOT NULL;
