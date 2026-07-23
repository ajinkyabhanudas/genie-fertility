/**
 * @file rag.ts
 * @description Core TypeScript interface definitions for Genie Fertility RAG Architecture
 */

export interface RAGDocumentChunk {
  id: string;
  refTag: string; // e.g. "[REF-1]", "[REF-2]"
  title: string;
  abstract: string;
  text: string;
  source: 'europe_pmc' | 'clinical_trials' | 'open_fda' | 'static_corpus' | 'internal_ip';
  sourceName: string;
  url?: string;
  doi?: string;
  pmid?: string;
  nctId?: string;
  publicationDate?: string;
  authors?: string[];
  embedding?: number[]; // 768-float vector array from text-embedding-004
}

export interface Citation {
  refTag: string;
  title: string;
  authors?: string;
  sourceName: string;
  url: string;
  doi?: string;
  pmid?: string;
  nctId?: string;
  snippet: string;
}

export interface RRFSearchResult {
  chunk: RAGDocumentChunk;
  bm25Rank?: number;
  vectorRank?: number;
  rrfScore: number;
  similarityScore: number;
  /** Raw BM25 score (not rank) — a low rank among few candidates does not imply
   * an actual keyword match; only a non-zero score does. */
  bm25Score: number;
}

/**
 * Retrieval trust state — what the UI shows instead of a fabricated confidence score.
 * 'grounded': semantic embeddings + at least one relevant source found.
 * 'degraded': fallback (non-semantic) embeddings were used, or a live source fetch failed.
 * 'data-gap': no relevant sources found at all, regardless of embedding mode.
 */
export type RetrievalState = 'grounded' | 'degraded' | 'data-gap';

/** Which embedding path produced the vectors used for this search. */
export type EmbeddingMode = 'semantic' | 'fallback';

export interface GroundedContextPayload {
  formattedPromptContext: string;
  citations: Citation[];
  chunks: RAGDocumentChunk[];
  /** Raw top retrieval similarity signal — NOT a confidence or faithfulness score. */
  topSimilarity: number;
  retrievalState: RetrievalState;
  embeddingMode: EmbeddingMode;
}

export interface GroundedPlaybookStepResponse {
  stepId: number;
  stepName: string;
  content: string;
  citations: Citation[];
  retrievalState: RetrievalState;
  timestamp: string;
}
