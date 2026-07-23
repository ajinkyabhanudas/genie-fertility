# Decisions & Deferrals

Tracks scope-narrowing decisions made during implementation — what was deferred,
why, and what should trigger revisiting it. SP-7 formalizes these as full ADRs;
this file is the running log until then.

## Active Deferrals

| # | Deferred | Reason | Revisit trigger | Added |
|---|----------|--------|------------------|-------|
| 1 | Provenance validator: live existence-resolution (PMID/DOI/NCT actually resolving against PubMed/ClinicalTrials.gov/CrossRef) | Live resolution requires network calls to third-party registries, which need the caching/fixture-replay layer to be safe under the "no live calls except human-triggered" contract. Shipping format-only validation now (regex-shape check) avoids adding an unsafe live-call surface before that layer exists. | When SP-3 (real-retrieval) or SP-5 (eval-harness) builds the caching/fixture-replay layer that makes live registry calls safe and cacheable. | 2026-07-23 |
| 2 | Fixture-record/replay wrapper (generic, SP-5-cassette-compatible design) | SP-5 (eval-harness) doesn't exist yet — its exact cassette format/keying scheme is unknown. A minimal scoped-to-this-phase wrapper was drafted, then removed: `server/index.test.ts` already mocks `@google/genai` directly with `vi.mock`, which covers this phase's actual test needs without an extra abstraction layer nothing else called. | When SP-5 (eval-harness) phase starts — build the real cassette system there, informed by what that phase actually needs. | 2026-07-23 |
| 3 | `/api/retrieve` route + relocating `hybridSearch.ts` (BM25/RRF/embedding orchestration) and its source connectors (europePmc/clinicalTrials/openFda) server-side | SP-2's spec item 6 asks for this, but SP-3's own doc explicitly states "the heavy logic moves server-side in SP-3; this phase just relocates the call boundary" — SP-3 owns building the real route. `hybridSearch.ts` and its connectors stay client-side this phase. A server-side copy (`server/sources/*`, `fetchWithPolicy.ts`) was drafted then removed — nothing called it yet, so it was duplicate code with no current value; redo it once, properly, in SP-3 against a real caller. | When SP-3 (real-retrieval) starts — build the real `/api/retrieve` route with true BM25 + pgvector + reranker, and move the connectors server-side with retry/backoff/cache at that point. | 2026-07-23 |

## Resolved

(none yet)
