/**
 * @file hybridSearch.ts
 * @description Reciprocal Rank Fusion (RRF) Hybrid Search Engine combining BM25 Keyword Search & Cosine Similarity Vector Embedding.
 */

import { RAGDocumentChunk, Citation, GroundedContextPayload, RRFSearchResult, RetrievalState, EmbeddingMode } from '../../types/rag';
import { getEmbedding, cosineSimilarity } from './embeddingService';
import { fetchEuropePmcArticles } from './sources/europePmc';
import { fetchClinicalTrials } from './sources/clinicalTrials';
import { fetchOpenFdaClearances } from './sources/openFda';
import { vectorCache } from './indexedDbStore';
import { STATIC_CORPUS } from './staticCorpus';

/**
 * Computes BM25 keyword score for a chunk given tokenized query terms.
 */
function computeBM25Score(chunk: RAGDocumentChunk, queryTerms: string[]): number {
  const text = (chunk.title + ' ' + chunk.abstract + ' ' + chunk.text).toLowerCase();
  let score = 0;

  queryTerms.forEach((term) => {
    if (!term || term.length < 2) return;
    const reg = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = text.match(reg);
    if (matches) {
      score += matches.length * 2.0;
    } else if (text.includes(term)) {
      score += 0.5;
    }
  });

  return score;
}

/**
 * Main Hybrid Search Engine entry point.
 */
export async function executeHybridRAGSearch(
  query: string,
  categoryKeyword?: string,
  topK: number = 5
): Promise<GroundedContextPayload> {
  const cleanQuery = query.trim();
  const searchTerms = cleanQuery.toLowerCase().split(/\s+/).filter(Boolean);

  // 1. Ingest candidates from static corpus
  const candidateMap = new Map<string, RAGDocumentChunk>();
  STATIC_CORPUS.forEach((chunk) => candidateMap.set(chunk.id, chunk));

  // 2. Fetch live data from open APIs asynchronously.
  // liveSourceFetchFailed feeds retrieval-state derivation below — a failure here means
  // the result is running on static/cached corpus only, which must surface as 'degraded',
  // not be silently presented as a fully live, grounded search.
  let liveSourceFetchFailed = false;
  try {
    const fetchKeyword = categoryKeyword || searchTerms[0] || 'fertility';
    const [pmcChunks, trialChunks, fdaChunks] = await Promise.all([
      fetchEuropePmcArticles(fetchKeyword, 5),
      fetchClinicalTrials(fetchKeyword, 4),
      fetchOpenFdaClearances(fetchKeyword, 3),
    ]);

    [...pmcChunks, ...trialChunks, ...fdaChunks].forEach((chunk) => {
      candidateMap.set(chunk.id, chunk);
      vectorCache.saveChunk(chunk);
    });
  } catch (e) {
    console.warn('Live API fetch encountered error, relying on static/cached corpus:', e);
    liveSourceFetchFailed = true;
  }

  const allCandidates = Array.from(candidateMap.values());
  if (allCandidates.length === 0) {
    return {
      formattedPromptContext: 'No relevant medical literature or regulatory data found in index.',
      citations: [],
      chunks: [],
      topSimilarity: 0,
      retrievalState: 'data-gap',
      embeddingMode: 'semantic',
    };
  }

  // 3. Compute Vector Embedding for Query & Chunks.
  // embeddingMode tracks whether ANY embedding in this search used the non-semantic
  // fallback vectorizer — if so, the whole result is 'degraded', never silently 'grounded'.
  let embeddingMode: EmbeddingMode = 'semantic';
  const queryResult = await getEmbedding(cleanQuery);
  if (queryResult.mode === 'fallback') embeddingMode = 'fallback';
  const queryEmbedding = queryResult.vector;

  const scoredCandidates = await Promise.all(
    allCandidates.map(async (chunk) => {
      if (!chunk.embedding) {
        const chunkResult = await getEmbedding(chunk.text);
        if (chunkResult.mode === 'fallback') embeddingMode = 'fallback';
        chunk.embedding = chunkResult.vector;
      }
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      const bm25 = computeBM25Score(chunk, searchTerms);
      return { chunk, similarity, bm25 };
    })
  );

  // 4. Sort for BM25 Ranks & Vector Ranks
  const sortedByBM25 = [...scoredCandidates].sort((a, b) => b.bm25 - a.bm25);
  const sortedByVector = [...scoredCandidates].sort((a, b) => b.similarity - a.similarity);

  const bm25RankMap = new Map<string, number>();
  sortedByBM25.forEach((item, idx) => bm25RankMap.set(item.chunk.id, idx + 1));

  const vectorRankMap = new Map<string, number>();
  sortedByVector.forEach((item, idx) => vectorRankMap.set(item.chunk.id, idx + 1));

  // 5. Compute Reciprocal Rank Fusion (RRF)
  const kConst = 60;
  const rrfResults: RRFSearchResult[] = scoredCandidates.map((item) => {
    const rBM25 = bm25RankMap.get(item.chunk.id) || 100;
    const rVector = vectorRankMap.get(item.chunk.id) || 100;
    const rrfScore = 1 / (kConst + rBM25) + 1 / (kConst + rVector);

    return {
      chunk: item.chunk,
      bm25Rank: rBM25,
      vectorRank: rVector,
      rrfScore,
      similarityScore: item.similarity,
      bm25Score: item.bm25,
    };
  });

  // 6. Select Top K Chunks
  const topResults = rrfResults.sort((a, b) => b.rrfScore - a.rrfScore).slice(0, topK);

  const selectedChunks = topResults.map((r) => r.chunk);
  const topSimilarity = Math.max(...topResults.map((r) => r.similarityScore), 0);

  // Retrieval state is derived from real signals only — never a fabricated confidence number.
  // Fallback (non-semantic) embeddings can never produce 'grounded', regardless of similarity
  // score, because a hash-bucket vectorizer's "similarity" is not a meaningful signal.
  // NOTE: bm25Rank alone is not evidence of relevance — with a small candidate pool, a
  // chunk can rank #1 with a BM25 score of 0 (no keyword overlap at all). Relevance
  // requires an actual non-zero BM25 score, not merely a low rank among few candidates.
  const hasRelevantMatch = topSimilarity >= 0.40 || topResults.some((r) => r.bm25Score > 0 && (r.bm25Rank || 100) <= 2);
  let retrievalState: RetrievalState;
  if (!hasRelevantMatch) {
    retrievalState = 'data-gap';
  } else if (embeddingMode === 'fallback' || liveSourceFetchFailed) {
    retrievalState = 'degraded';
  } else {
    retrievalState = 'grounded';
  }

  // 7. Format Prompt Context Payload & Citations
  const citations: Citation[] = selectedChunks.map((c, i) => {
    const tag = `[REF-${i + 1}]`;
    c.refTag = tag;
    return {
      refTag: tag,
      title: c.title,
      authors: c.authors?.join(', '),
      sourceName: c.sourceName,
      url: c.url || '',
      doi: c.doi,
      pmid: c.pmid,
      nctId: c.nctId,
      snippet: c.abstract.slice(0, 200) + '...',
    };
  });

  const formattedPromptContext = selectedChunks
    .map(
      (c, i) =>
        `REFERENCE ${c.refTag} (Source: ${c.sourceName}):\nTitle: ${c.title}\nContent:\n${c.text}\n---`
    )
    .join('\n\n');

  return {
    formattedPromptContext,
    citations,
    chunks: selectedChunks,
    topSimilarity,
    retrievalState,
    embeddingMode,
  };
}
