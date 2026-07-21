/**
 * @file embeddingService.ts
 * @description Generates 768-dimensional vector embeddings using Google GenAI text-embedding-004.
 * Includes a deterministic TF-IDF fallback vectorizer if offline or without API key.
 */

import { GoogleGenAI } from "@google/genai";

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
 * Used if network API fails or offline mode is active.
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
 * Generates vector embedding via Gemini API text-embedding-004.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return generateFallbackEmbedding(text);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text.slice(0, 2048), // Cap chunk length
    });

    const res = response as any;
    if (res.embedding?.values) {
      return res.embedding.values;
    }
    if (res.embeddings?.[0]?.values) {
      return res.embeddings[0].values;
    }
    return generateFallbackEmbedding(text);
  } catch (error) {
    console.warn("Gemini embedding API call failed, using fallback vectorizer:", error);
    return generateFallbackEmbedding(text);
  }
}
