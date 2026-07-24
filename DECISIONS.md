# Decisions & Deferrals

Tracks scope-narrowing decisions made during implementation — what was deferred,
why, and what should trigger revisiting it. SP-7 formalizes these as full ADRs;
this file is the running log until then.

## Current Status (as of 2026-07-23)

- **SP-1 (retrieval-state-ui):** MERGED to `main` via PR #1. Branch deleted.
- **SP-2 (secure-backend):** MERGED to `main` via PR #2. Branch deleted.
  Auth, hash-chained audit log, Postgres+pgvector persistence, idempotent
  generation caching, CI bundle gate — all verified on `main` (50/50 tests
  pass, `npm run lint` clean). Full scope per
  `~/.claude/plans/genie-subplans/SP-2-backend-bff.md` is covered except
  the 3 items logged as active deferrals below.
- **SP-3 (real-retrieval):** IN PROGRESS on `real-retrieval`. Owns: the
  real `/api/retrieve` route, moving `hybridSearch.ts`'s BM25/RRF logic and
  the 3 source connectors server-side with retry/backoff/cache, true BM25 +
  pgvector + reranker, live provenance existence-resolution. Broken into
  8 ordered sub-tasks (SP-3.1–SP-3.8) below — dependency-ordered, each
  independently committable and resumable across sessions.
- **SP-4 (company-baselines):** not started — unblocked (SP-2 merged), parallel with SP-3.
- **SP-5 (eval-harness):** not started. Depends on SP-3 + SP-4 merged. ★ centrepiece.
- **SP-6 (consultant-panel):** not started. Depends on SP-3 + SP-5 merged.
- **SP-7 (docs):** not started. Continuous — a slice merges alongside each phase.
  This README/DECISIONS maintenance is the first slice.

Full SP plan files: `~/.claude/plans/genie-subplans/SP-*.md` (not in this repo).

## SP-3 sub-task tracker (dependency-ordered, resumable across sessions)

Source of truth for SP-3 progress. Update the status column as each lands;
do not reorder — later items depend on earlier ones landing first. Each
sub-task should be its own commit (or small commit group) on `real-retrieval`,
tested before moving to the next.

| # | Sub-task | Depends on | Status |
|---|----------|------------|--------|
| SP-3.1 | Ingest pipeline (`server/retrieval/ingest.ts`): chunk → embed-once → store vector + FTS tsvector + metadata in `document_chunks`. Idempotent by chunk id + content hash (re-ingest of unchanged chunk = 0 embed calls). Migration `002_ingest_fts.sql` adds `content_hash`/`fts_vector` columns. | SP-2 schema (`document_chunks`, merged) | Core + tests done; static-corpus loader script deferred to SP-3.4 |
| SP-3.2 | Real sparse scoring (`server/retrieval/bm25.ts` or Postgres FTS/`ts_rank`): IDF + doc-length normalisation over corpus stats, not per-query regex counting. | SP-3.1 (needs populated tsvector column) | Not started |
| SP-3.3 | pgvector ANN query path: HNSW/IVFFlat index on `document_chunks.embedding`, query-embeds-only (no corpus re-embedding) similarity search. | SP-3.1 (needs populated embeddings) | Not started |
| SP-3.4 | `server/retrieval/index.ts` + `/api/retrieve` route: query-embed → dense ANN + sparse FTS → RRF merge (reuse `hybridSearch.ts`'s RRF math, k=60) → top-k candidates. Also owns the static-corpus loader script (deferred from SP-3.1 — no real caller existed yet). | SP-3.2, SP-3.3 | Not started |
| SP-3.5 | Reranker adapter (`server/retrieval/rerank.ts`): Cohere Rerank v3 (or open reranker if data-residency requires), fixture-record/replay wrapper for tests (G2 — no live calls in CI). Retrieve-50 → rerank-5. | SP-3.4 | Not started |
| SP-3.6 | Provenance gate wiring: unresolved citations demoted/flagged before ranked results reach the client — never surfaced as verified. Reuses SP-2's validator. | SP-3.4 | Not started |
| SP-3.7 | Client cutover: retire per-query re-embedding loop in `hybridSearch.ts` and the vector-store role of `indexedDbStore.ts` (client keeps a thin UI-result cache only); client posts query to `/api/retrieve` and renders server results. | SP-3.4, SP-3.5, SP-3.6 | Not started |
| SP-3.8 | Retrieval-quality harness (shared scaffold with SP-5): context precision/recall on the golden set, replayed from fixtures, before (regex-BM25) vs after (real hybrid+rerank) measured lift. Threshold gate in CI. | SP-3.4–SP-3.7 | Not started |

Failure-mode contracts (apply to all sub-tasks above, per SP-3 spec NFR section):
reranker down → fall back to RRF-only, mark `degraded`. ANN down → sparse-only,
mark `degraded`. Never silent. Ingest idempotency is a hard gate (SP-3.1's own
test asserts embed-call counter == 0 on re-ingest of unchanged chunk).

## Active Deferrals

| # | Deferred | Reason | Revisit trigger | Added |
|---|----------|--------|------------------|-------|
| 1 | Provenance validator: live existence-resolution (PMID/DOI/NCT actually resolving against PubMed/ClinicalTrials.gov/CrossRef) | Live resolution requires network calls to third-party registries, which need the caching/fixture-replay layer to be safe under the "no live calls except human-triggered" contract. Shipping format-only validation now (regex-shape check) avoids adding an unsafe live-call surface before that layer exists. | When SP-3 (real-retrieval) or SP-5 (eval-harness) builds the caching/fixture-replay layer that makes live registry calls safe and cacheable. | 2026-07-23 |
| 2 | Fixture-record/replay wrapper (generic, SP-5-cassette-compatible design) | SP-5 (eval-harness) doesn't exist yet — its exact cassette format/keying scheme is unknown. A minimal scoped-to-this-phase wrapper was drafted, then removed: `server/index.test.ts` already mocks `@google/genai` directly with `vi.mock`, which covers this phase's actual test needs without an extra abstraction layer nothing else called. | When SP-5 (eval-harness) phase starts — build the real cassette system there, informed by what that phase actually needs. | 2026-07-23 |
| 3 | `/api/retrieve` route + relocating `hybridSearch.ts` (BM25/RRF/embedding orchestration) and its source connectors (europePmc/clinicalTrials/openFda) server-side | SP-2's spec item 6 asks for this, but SP-3's own doc explicitly states "the heavy logic moves server-side in SP-3; this phase just relocates the call boundary" — SP-3 owns building the real route. `hybridSearch.ts` and its connectors stay client-side this phase. A server-side copy (`server/sources/*`, `fetchWithPolicy.ts`) was drafted then removed — nothing called it yet, so it was duplicate code with no current value; redo it once, properly, in SP-3 against a real caller. | When SP-3 (real-retrieval) starts — build the real `/api/retrieve` route with true BM25 + pgvector + reranker, and move the connectors server-side with retry/backoff/cache at that point. | 2026-07-23 |

## Resolved

(none yet)
