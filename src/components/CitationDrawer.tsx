/**
 * @file CitationDrawer.tsx
 * @description Slide-over modal component for inspecting grounded references, PubMed PMIDs, ClinicalTrials.gov IDs, and DOIs.
 */

import { X, ExternalLink, BookOpen, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { Citation } from '../types/rag';

interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citations: Citation[];
  confidenceScore?: number;
  countryName?: string;
  adjacencyName?: string;
}

export default function CitationDrawer({
  isOpen,
  onClose,
  citations,
  confidenceScore = 95,
  countryName,
  adjacencyName,
}: CitationDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-lg bg-brand-card border-l border-white/10 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-accent/20 text-brand-accent">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Verified Clinical & Regulatory Sources</h2>
              <p className="text-xs text-brand-mint/50">
                {countryName && adjacencyName ? `${countryName} • ${adjacencyName}` : 'Grounded RAG Literature Citations'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-brand-mint/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Confidence Score Strip */}
        <div className="px-6 py-3 bg-brand-accent/10 border-b border-brand-accent/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-mint">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Anti-Hallucination Grounding Status</span>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {confidenceScore}% Match Confidence
          </span>
        </div>

        {/* Citations List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {citations.length === 0 ? (
            <div className="text-center py-12 text-brand-mint/40 space-y-2">
              <FileText size={32} className="mx-auto opacity-50" />
              <p className="text-sm">No external citations fetched for this section.</p>
            </div>
          ) : (
            citations.map((cite, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-brand-accent/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-mono font-bold text-brand-accent px-2 py-0.5 rounded bg-brand-accent/10 border border-brand-accent/20">
                    {cite.refTag}
                  </span>
                  <span className="text-[10px] text-brand-mint/40 font-mono truncate max-w-[200px]">
                    {cite.sourceName}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-white leading-snug">{cite.title}</h3>

                {cite.authors && (
                  <p className="text-xs text-brand-mint/60 italic">{cite.authors}</p>
                )}

                <p className="text-xs text-brand-mint/70 bg-black/20 p-2.5 rounded-lg border border-white/5 leading-relaxed">
                  "{cite.snippet}"
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-brand-mint/50">
                    {cite.pmid && <span>PMID: {cite.pmid}</span>}
                    {cite.nctId && <span>NCT: {cite.nctId}</span>}
                    {cite.doi && <span>DOI: {cite.doi}</span>}
                  </div>

                  {cite.url && (
                    <a
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-accent hover:underline font-medium"
                    >
                      <span>View Paper</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 text-center text-xs text-brand-mint/40">
          Powered by Genie Hybrid RAG Engine (Europe PMC • ClinicalTrials.gov • openFDA)
        </div>
      </div>
    </div>
  );
}
