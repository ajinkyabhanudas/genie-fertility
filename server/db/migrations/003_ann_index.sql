-- SP-3.3: HNSW index for approximate nearest-neighbour search over
-- document_chunks.embedding. Without this, a similarity query is a full
-- table scan computing cosine distance against every row — HNSW makes it
-- sub-linear, which is what lets the corpus grow without the query path
-- slowing down proportionally (the whole point of an ANN index).
--
-- vector_cosine_ops matches this project's chosen distance metric (cosine
-- similarity, consistent with hybridSearch.ts's existing cosineSimilarity
-- client-side logic being replaced).

CREATE INDEX idx_document_chunks_embedding_hnsw
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops);
