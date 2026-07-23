import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { RetrievalState } from '../types/rag';

/**
 * Single source of truth for retrieval-state -> (label, color, tooltip).
 * Replaces the previous fabricated numeric confidence percentage: a percentage
 * implies a measured accuracy this system does not compute. Real faithfulness
 * scoring lands with the eval harness; until then we show only what actually
 * happened during retrieval.
 */
const STATE_CONFIG: Record<
  RetrievalState,
  { label: string; description: string; icon: typeof ShieldCheck; textClass: string; bgClass: string; borderClass: string }
> = {
  grounded: {
    label: 'Grounded',
    description: 'Semantic search found relevant sources; not yet verified for claim-level accuracy.',
    icon: ShieldCheck,
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
  },
  degraded: {
    label: 'Degraded retrieval',
    description: 'Running on fallback (non-semantic) embeddings or a live source fetch failed — results may be less relevant than usual.',
    icon: ShieldAlert,
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
  },
  'data-gap': {
    label: 'Data gap',
    description: 'No relevant sources found in the indexed registries for this query.',
    icon: ShieldQuestion,
    textClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
  },
};

interface RetrievalStateBadgeProps {
  state: RetrievalState;
  className?: string;
}

export default function RetrievalStateBadge({ state, className = '' }: RetrievalStateBadgeProps) {
  const cfg = STATE_CONFIG[state];
  const Icon = cfg.icon;

  return (
    <span
      title={cfg.description}
      className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-0.5 rounded border ${cfg.textClass} ${cfg.bgClass} ${cfg.borderClass} ${className}`}
    >
      <Icon size={13} />
      {cfg.label}
    </span>
  );
}

export { STATE_CONFIG as RETRIEVAL_STATE_CONFIG };
