/**
 * @file embeddingService.ts
 * @description Generates 768-dimensional vector embeddings via the backend proxy
 * (server/index.ts), which holds the Gemini API key. Includes a deterministic
 * TF-IDF fallback vectorizer if the proxy is unreachable or returns an error.
 */

import { EmbeddingMode } from "../../types/rag";

export interface EmbeddingResult {
  vector: number[];
  mode: EmbeddingMode;
}

/**
 * Cosine Similarity calculation between two 1D vector arrays.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Fallback lightweight deterministic hashing vectorizer (768 dimensions)
 * Used if the proxy is unreachable, returns an error, or has no key configured.
 */
function generateFallbackEmbedding(text: string, dimensions: number = 768): number[] {
  const vec = new Array(dimensions).fill(0);
  const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = cleanText.split(/\s+/).filter(Boolean);

  words.forEach((word) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 1;
  });

  // Normalize vector
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] /= norm;
    }
  }

  return vec;
}

/**
 * Generates vector embedding via the backend proxy's /api/embed endpoint.
 * Returns which mode produced the vector so callers can surface degraded state
 * instead of silently presenting fallback (non-semantic) vectors as normal.
 */
export async function getEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const response = await fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 2048) }),
    });

    if (!response.ok) {
      return { vector: generateFallbackEmbedding(text), mode: 'fallback' };
    }

    const data = await response.json();
    if (Array.isArray(data.vector)) {
      return { vector: data.vector, mode: 'semantic' };
    }

    return { vector: generateFallbackEmbedding(text), mode: 'fallback' };
  } catch (error) {
    console.warn("Embedding proxy call failed, using fallback vectorizer:", error);
    return { vector: generateFallbackEmbedding(text), mode: 'fallback' };
  }
}
