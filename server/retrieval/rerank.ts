/**
 * @file rerank.ts
 * @description SP-3.5: reranker adapter. Self-hosted BGE cross-encoder
 * (Xenova/bge-reranker-base) via @huggingface/transformers, running ONNX
 * in-process — no external API call, no key, no per-query cost (see
 * DECISIONS.md D1 for the full "why not Cohere" rationale).
 *
 * Implements the retrieve-50 -> rerank-5 pattern: given the RRF-fused
 * candidate pool, scores each (query, candidate text) pair directly and
 * returns the candidates re-ordered by that score. Model load or inference
 * failure is the "reranker down" case from the SP-3 spec's failure
 * contract — callers must catch and fall back to RRF-only ordering.
 */

import { AutoTokenizer, AutoModelForSequenceClassification } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/bge-reranker-base';

export interface RerankCandidate {
  id: string;
  text: string;
}

export interface RerankedResult {
  id: string;
  rerankScore: number;
}

let modelPromise: Promise<{ tokenizer: any; model: any }> | null = null;

/**
 * Lazily loads the tokenizer + model once per process, on first call —
 * mirrors the singleton pattern server/index.ts uses for the GoogleGenAI
 * client. A load failure resets the singleton so the next call retries
 * rather than permanently caching the rejection — a transient issue on
 * first load (e.g. a network blip fetching model weights) must not
 * degrade every request for the rest of the process lifetime.
 */
function loadModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
      const model = await AutoModelForSequenceClassification.from_pretrained(MODEL_ID);
      return { tokenizer, model };
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }
  return modelPromise;
}

/**
 * Scores each candidate against `query` and returns them re-ordered by
 * rerank score, descending. Throws on model load or inference failure —
 * callers are responsible for the RRF-only degraded fallback.
 */
export async function rerank(query: string, candidates: RerankCandidate[]): Promise<RerankedResult[]> {
  if (candidates.length === 0) return [];

  const { tokenizer, model } = await loadModel();

  const scored = await Promise.all(
    candidates.map(async (candidate) => {
      const inputs = await tokenizer(query, {
        text_pair: candidate.text,
        padding: true,
        truncation: true,
      });
      const output = await model(inputs);
      const rerankScore = Number(output.logits.data[0]);
      return { id: candidate.id, rerankScore };
    })
  );

  return scored.sort((a, b) => b.rerankScore - a.rerankScore);
}
