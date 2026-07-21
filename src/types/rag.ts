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
}

export interface GroundedContextPayload {
  formattedPromptContext: string;
  citations: Citation[];
  chunks: RAGDocumentChunk[];
  maxSimilarity: number;
  isGrounded: boolean;
  hasDataGap: boolean;
}

export interface GroundedPlaybookStepResponse {
  stepId: number;
  stepName: string;
  content: string;
  citations: Citation[];
  confidenceScore: number;
  hasDataGap: boolean;
  timestamp: string;
}
