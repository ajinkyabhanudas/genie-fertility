import { useState, Fragment } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Cell,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────
type Scores = Record<string, number>;
interface Weights { w1: number; w2: number; w3: number; }
type TabId = 'editor' | 'ranking' | 'generic';

// ── Static data ────────────────────────────────────────────────────────────
const CONSTITUENTS = [
  { pillar:1, id:'c11', name:'Total addressable market',               shortName:'TAM',         desc:'Annual IVF cycle volume',               rubric:['Very small - under 20,000 cycles/yr','Small - 20,000 to 40,000 cycles/yr','Moderate - 40,000 to 80,000 cycles/yr','Large - 80,000 to 150,000 cycles/yr','Massive - over 150,000 cycles/yr'] },
  { pillar:1, id:'c12', name:'Payment landscape & willingness to pay', shortName:'Payment',      desc:'Private vs state funding balance',       rubric:['Exclusively state-funded, strict price controls','Mostly state-funded, limited private sector','Mixed market - balance of public and private','Predominantly private pay, strong add-on demand','Highly commercialised - patients actively seek premium diagnostics'] },
  { pillar:1, id:'c13', name:'Digital health & innovation maturity',   shortName:'Digital',      desc:'Clinic technology adoption culture',      rubric:['Laggard - traditional, resistant to new tech','Late adopter - slow uptake, requires global proof first','Average - adopts proven tools, not early mover','Early adopter - actively trials new methods','Pioneer / global hub - world-renowned for innovation'] },
  { pillar:2, id:'c21', name:'IVD approval pathway',                   shortName:'IVD Path',     desc:'Regulatory timeline & complexity',        rubric:['Highly complex - opaque, 2+ years, no AI/SaMD guidance','Strict and lengthy - defined but slow, 18-24 months','Standard pathway - clear process, 12-18 months','Favourable / fast-track - 6-12 months for innovative diagnostics','Automatic / mutual recognition - accepts CE or UKCA mark, under 6 months'] },
  { pillar:2, id:'c22', name:'Data privacy & ML processing',           shortName:'Data Privacy', desc:'Cross-border data transfer friction',     rubric:['Strict data localisation - patient data cannot leave country','High friction - transfer legal but heavily restricted','Moderate friction - standard compliance work required','Low friction - aligned with UK/EU law, minimal workflow changes','Seamless - GDPR or full data adequacy with UK'] },
  { pillar:2, id:'c23', name:'Clinical evidence requirements',         shortName:'Evidence',     desc:'Data portability / trial burden',         rubric:['Net-new localised trials mandated - foreign data entirely rejected','Major bridging studies needed - significant local trials still required','Real-world evidence needed - regulator accepts data, clinics require local pilot','High acceptance - regulators accept 200k+ dataset, only nominal pilot needed','Total reciprocity - immediate full acceptance, zero additional trials required'] },
  { pillar:3, id:'c31', name:'Biological sample logistics',            shortName:'Logistics',    desc:'Menstrual blood processing viability',    rubric:['Bio-export banned or near-impossible - potential knock-out barrier','Highly restricted - plagued by delays, spoilage risk, high costs','Manageable - moderate paperwork, average costs, reliable practice','Easy shipping - reliable, fast, low-cost, minimal customs friction','Seamless - next-day domestic delivery, zero customs friction'] },
  { pillar:3, id:'c32', name:'Clinic ecosystem',                       shortName:'Clinics',      desc:'B2B sales efficiency',                    rubric:['Highly fragmented - hundreds of independent single-doctor clinics','Mostly fragmented - few small groups, majority independent','Moderately consolidated - mix of independent and mid-sized chains','Highly consolidated - handful of large networks control majority of cycles','Oligopoly - 1-2 massive networks dominate, single deal unlocks 50%+ of market'] },
  { pillar:3, id:'c33', name:'Key opinion leader access',              shortName:'KOL Access',   desc:'Research hub quality & global influence', rubric:['No presence - no internationally recognised institutions or KOLs','Weak presence - limited research, hard to find influential adopters','Average presence - solid local expertise, sufficient for standard pilot','Strong ecosystem - respected KOLs present, publish in major journals','World-leading hub - most influential KOLs globally, pilot results set global standards'] },
  { pillar:3, id:'c34', name:'HQ proximity & local presence',          shortName:'Proximity',    desc:'Travel & coordination overhead',          rubric:['Remote / very high burden - 10+ hour flight, 8+ hour time zone offset','Distant / high burden - 10+ hours, each trip requires approx. one week','Moderate distance - 5-10 hour flight, 4-6 hour offset, periodic multi-day visits','Near / low friction - 3-5 hour flight, 2-3 hour offset, occasional visits only','Home market / adjacent - under 3 hours from London, day trips feasible, no local entity needed'] },
];

const PILLAR_COLORS = ['#b59df2', '#60a5fa', '#fbbf24'];
const PILLAR_NAMES  = ['Commercial', 'Regulatory', 'Operational'];
const DEFAULT_W: Weights = { w1: 33, w2: 33, w3: 34 };

// ── Per-country market detail ──────────────────────────────────────────────
interface CountryDetail {
  stats: { label: string; value: string }[];
  context: string;
}

import { ORIG_DATA, COUNTRY_DETAILS } from '../data/countries';

// ── Pure helpers ───────────────────────────────────────────────────────────
function pillarAvg(scores: Scores, pillar: number): number {
  const keys = CONSTITUENTS.filter(c => c.pillar === pillar).map(c => c.id);
  return keys.reduce((a, k) => a + scores[k], 0) / keys.length;
}

function weightedFinal(scores: Scores, w: Weights): number {
  const total = w.w1 + w.w2 + w.w3;
  if (total === 0) return 0;
  return (pillarAvg(scores,1)*w.w1 + pillarAvg(scores,2)*w.w2 + pillarAvg(scores,3)*w.w3) / total;
}

function fmt(n: number) { return n.toFixed(2); }

function getTier(score: number) {
  if (score >= 4.0) return { label:'Tier 1 - Priority',   color:'#b59df2', bg:'rgba(181,157,242,0.15)' };
  if (score >= 3.4) return { label:'Tier 2 - Secondary',  color:'#60a5fa', bg:'rgba(96,165,250,0.15)'  };
  if (score >= 3.0) return { label:'Tier 3 - Long-term',  color:'#fbbf24', bg:'rgba(251,191,36,0.15)'  };
  return                   { label:'Tier 4 - Avoid',      color:'#E8604C', bg:'rgba(232,96,76,0.15)'   };
}

// ── Sub-components ─────────────────────────────────────────────────────────
function TierBadge({ score }: { score: number }) {
  const t = getTier(score);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ color: t.color, backgroundColor: t.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
      {t.label}
    </span>
  );
}

function WeightStrip({
  weights, onChange, onReset,
}: {
  weights: Weights;
  onChange: (w: Weights) => void;
  onReset: () => void;
}) {
  const total = weights.w1 + weights.w2 + weights.w3;
  const sliders = [
    { key:'w1' as const, label:'Commercial', color: PILLAR_COLORS[0] },
    { key:'w2' as const, label:'Regulatory', color: PILLAR_COLORS[1] },
    { key:'w3' as const, label:'Operational',color: PILLAR_COLORS[2] },
  ];

  const handleSliderChange = (key: keyof Weights, value: number) => {
    const newVal = Math.max(0, Math.min(100, value));
    const otherKeys = (Object.keys(weights) as (keyof Weights)[]).filter(k => k !== key);
    const sumOthers = otherKeys.reduce((acc, k) => acc + weights[k], 0);

    const diff = newVal - weights[key];
    if (diff === 0) return;

    const nextWeights = { ...weights, [key]: newVal };

    if (sumOthers > 0) {
      let remainingDiff = -diff;
      otherKeys.forEach((k, i) => {
        if (i === otherKeys.length - 1) {
          nextWeights[k] = Math.max(0, weights[k] + remainingDiff);
        } else {
          const share = Math.round((weights[k] / sumOthers) * -diff);
          nextWeights[k] = Math.max(0, weights[k] + share);
          remainingDiff -= (nextWeights[k] - weights[k]);
        }
      });
    } else {
      const remainder = 100 - newVal;
      nextWeights[otherKeys[0]] = Math.floor(remainder / 2);
      nextWeights[otherKeys[1]] = remainder - nextWeights[otherKeys[0]];
    }

    const finalSum = nextWeights.w1 + nextWeights.w2 + nextWeights.w3;
    if (finalSum !== 100) {
      if (finalSum > 100) {
        nextWeights[key] -= (finalSum - 100);
      } else {
        const adj = 100 - finalSum;
        const target = nextWeights[otherKeys[0]] >= nextWeights[otherKeys[1]] ? otherKeys[0] : otherKeys[1];
        nextWeights[target] += adj;
      }
    }

    onChange(nextWeights);
  };

  return (
    <div className="bg-brand-card rounded-2xl border border-white/10 p-4 mb-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 pr-4 border-r border-white/10">
          <span className="text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold whitespace-nowrap">
            Pillar weights
          </span>
          <span className="text-xs font-mono font-bold text-brand-accent px-2 py-0.5 rounded-full bg-brand-accent/10">
            {total}%
          </span>
        </div>

        {sliders.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-3 flex-1 min-w-44">
            <span className="text-xs font-medium whitespace-nowrap w-20" style={{ color }}>{label}</span>
            <input
              type="range" min="0" max="100" step="1"
              value={weights[key]}
              onChange={e => handleSliderChange(key, parseInt(e.target.value))}
              className="flex-1 accent-[#b59df2] h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs font-mono font-bold w-10 text-right text-brand-mint/80">
              {weights[key]}%
            </span>
          </div>
        ))}

        <button
          onClick={onReset}
          className="text-xs text-brand-mint/40 border border-white/10 rounded-lg px-3 py-1.5 hover:border-brand-accent/30 hover:text-brand-accent transition-all ml-auto"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}

function ConstituentSlider({
  constituent, value, onChange, color,
}: {
  constituent: typeof CONSTITUENTS[0];
  value: number;
  onChange: (v: number) => void;
  color: string;
  key?: string | number;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex-1 pr-3">
          <div className="text-sm font-medium text-brand-mint leading-snug">{constituent.name}</div>
          <div className="text-[11px] text-brand-mint/40 mt-0.5">{constituent.desc}</div>
        </div>
        <span className="font-mono text-xl font-medium flex-shrink-0" style={{ color }}>{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-brand-mint/30 font-mono w-2">1</span>
        <input
          type="range" min="1" max="5" step="1" value={value}
          onChange={e => onChange(parseInt(e.target.value))}
          className="flex-1 accent-[#b59df2]"
        />
        <span className="text-[10px] text-brand-mint/30 font-mono w-2">5</span>
      </div>
      <div className="text-[10px] text-brand-mint/35 mt-1 italic leading-relaxed">
        {constituent.rubric[value - 1]}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ScoringDashboard({ data, setData }: { data: any[], setData: React.Dispatch<React.SetStateAction<any[]>> }) {
  const [activeTab,      setActiveTab]      = useState<TabId>('editor');
  const [editorWeights,  setEditorWeights]  = useState<Weights>({ ...DEFAULT_W });
  const [rankingWeights, setRankingWeights] = useState<Weights>({ ...DEFAULT_W });
  const [genericWeights, setGenericWeights] = useState<Weights>({ ...DEFAULT_W });
  const [selectedIdx,    setSelectedIdx]    = useState(0);
  const [genScores,      setGenScores]      = useState<Scores>(
    Object.fromEntries(CONSTITUENTS.map(c => [c.id, 3]))
  );
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const [newCountryName, setNewCountryName] = useState('');

  // ── Editor derived values ──────────────────────────────────────────────
  const selected      = data[selectedIdx];
  const editorP1      = pillarAvg(selected.s, 1);
  const editorP2      = pillarAvg(selected.s, 2);
  const editorP3      = pillarAvg(selected.s, 3);
  const editorFinal   = weightedFinal(selected.s, editorWeights);
  const editorPillarAvgs = [editorP1, editorP2, editorP3];

  const radarData = CONSTITUENTS.map(c => ({
    subject: c.shortName,
    value:   selected.s[c.id],
    fullMark: 5,
  }));

  function updateScore(idx: number, cid: string, val: number) {
    setData(prev => prev.map((c, i) =>
      i === idx ? { ...c, s: { ...c.s, [cid]: val } } : c
    ));
  }

  function resetCountry() {
    const orig = ORIG_DATA[selectedIdx];
    setData(prev => prev.map((c, i) =>
      i === selectedIdx ? { name: orig.name, s: { ...orig.s } } : c
    ));
  }

  // ── Ranking derived values ─────────────────────────────────────────────
  const ranked = data.map(c => ({
    name: c.name,
    p1:   pillarAvg(c.s, 1),
    p2:   pillarAvg(c.s, 2),
    p3:   pillarAvg(c.s, 3),
    fs:   weightedFinal(c.s, rankingWeights),
  })).sort((a, b) => b.fs - a.fs);

  const barData = ranked.map(r => ({
    name:  r.name,
    score: parseFloat(fmt(r.fs)),
    color: getTier(r.fs).color,
  }));

  // ── Generic derived values ─────────────────────────────────────────────
  const genP1    = pillarAvg(genScores, 1);
  const genP2    = pillarAvg(genScores, 2);
  const genP3    = pillarAvg(genScores, 3);
  const genFinal = weightedFinal(genScores, genericWeights);

  const tabs: { id: TabId; label: string }[] = [
    { id:'editor',  label:'Country Editor'   },
    { id:'ranking', label:'Full Ranking'     },
    { id:'generic', label:'New Country'      },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold mb-2">Market Scoring Dashboard</h1>
        <p className="text-brand-mint/60">
          Score markets across Commercial, Regulatory, and Operational pillars to prioritise international expansion.
        </p>
      </header>

      {/* Inner tab nav */}
      <div className="flex gap-1 bg-brand-card rounded-xl p-1 w-fit border border-white/10">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-brand-accent text-brand-bg shadow-md shadow-brand-accent/20'
                : 'text-brand-mint/60 hover:text-brand-mint hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── COUNTRY EDITOR ────────────────────────────────────────────────── */}
      {activeTab === 'editor' && (
        <div className="space-y-5">
          <WeightStrip
            weights={editorWeights}
            onChange={setEditorWeights}
            onReset={() => setEditorWeights({ ...DEFAULT_W })}
          />

          <div className="flex items-center gap-3">
            <span className="text-sm text-brand-mint/60 font-medium">Editing:</span>
            <select
              value={selectedIdx}
              onChange={e => setSelectedIdx(parseInt(e.target.value))}
              className="bg-brand-card border border-white/20 text-brand-mint rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-brand-accent"
            >
              {data.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
            </select>
            <button
              onClick={resetCountry}
              className="text-xs text-brand-mint/40 border border-white/10 rounded-lg px-3 py-1.5 hover:border-white/20 hover:text-brand-mint/70 transition-all"
            >
              ↺ Reset scores
            </button>
          </div>

          {/* Score hero + radar */}
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
            <div className="bg-brand-card rounded-2xl border border-white/10 p-6">
              <div className="text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold mb-4">Final Score</div>
              <div className="font-display text-7xl font-light text-brand-mint leading-none mb-2">
                {fmt(editorFinal)}
              </div>
              <div className="text-xs text-brand-mint/40 mb-4">out of 5.00</div>
              <TierBadge score={editorFinal} />
              <div className="grid grid-cols-3 gap-2 mt-6">
                {editorPillarAvgs.map((avg, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3">
                    <div className="font-mono text-lg font-medium" style={{ color: PILLAR_COLORS[i] }}>
                      {fmt(avg)}
                    </div>
                    <div className="text-[10px] text-brand-mint/40 uppercase tracking-wide mt-0.5">
                      {PILLAR_NAMES[i]}
                    </div>
                    <div className="text-[10px] text-brand-mint/30 font-mono mt-0.5">
                      wt: {[editorWeights.w1, editorWeights.w2, editorWeights.w3][i]}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-brand-card rounded-2xl border border-white/10 p-6">
              <div className="text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold mb-4">
                Pillar Radar - Constituent Scores
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="rgba(219,226,255,0.1)" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'rgba(219,226,255,0.5)', fontSize: 10 }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 5]} tickCount={6}
                    tick={{ fill: 'rgba(219,226,255,0.3)', fontSize: 9 }}
                    axisLine={false}
                  />
                  <Radar
                    name={selected.name}
                    dataKey="value"
                    stroke="#b59df2"
                    fill="#b59df2"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#b59df2' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3 pillar cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(p => (
              <div key={p} className="bg-brand-card rounded-2xl border border-white/10 p-5">
                <div
                  className="flex justify-between items-center pb-3 mb-4 border-b"
                  style={{ borderColor: `${PILLAR_COLORS[p-1]}40` }}
                >
                  <span
                    className="text-[10px] uppercase tracking-widest font-bold"
                    style={{ color: PILLAR_COLORS[p-1] }}
                  >
                    Pillar {p} - {PILLAR_NAMES[p-1]}
                  </span>
                  <span className="font-mono text-sm font-medium text-brand-mint">
                    {fmt(editorPillarAvgs[p-1])}
                  </span>
                </div>
                {CONSTITUENTS.filter(c => c.pillar === p).map(c => (
                  <ConstituentSlider
                    key={c.id}
                    constituent={c}
                    value={selected.s[c.id]}
                    onChange={val => updateScore(selectedIdx, c.id, val)}
                    color={PILLAR_COLORS[p-1]}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FULL RANKING ──────────────────────────────────────────────────── */}
      {activeTab === 'ranking' && (
        <div className="space-y-5">
          <WeightStrip
            weights={rankingWeights}
            onChange={setRankingWeights}
            onReset={() => setRankingWeights({ ...DEFAULT_W })}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
            {/* Table */}
            <div className="bg-brand-card rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <span className="text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold">
                  All {data.length} markets - live ranking
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5">
                    <th className="text-left text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold px-4 py-3 w-8">#</th>
                    <th className="text-left text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold px-4 py-3">Country</th>
                    {PILLAR_NAMES.map((name, i) => (
                      <th key={name} className="text-left text-[10px] uppercase tracking-widest font-bold px-4 py-3"
                          style={{ color: PILLAR_COLORS[i] + '99' }}>
                        {name}
                      </th>
                    ))}
                    <th className="text-left text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold px-4 py-3">Final</th>
                    <th className="text-left text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold px-4 py-3">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r, i) => {
                    const tier      = getTier(r.fs);
                    const isOpen    = expandedCountry === r.name;
                    const detail    = COUNTRY_DETAILS[r.name];
                    return (
                      <Fragment key={r.name}>
                        <tr
                          onClick={() => setExpandedCountry(isOpen ? null : r.name)}
                          className="border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer select-none"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-brand-mint/30">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-brand-mint flex items-center gap-2">
                            <span
                              className="text-brand-mint/30 text-xs transition-transform duration-200 inline-block"
                              style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            >
                              ▶
                            </span>
                            {r.name}
                          </td>
                          {[r.p1, r.p2, r.p3].map((v, pi) => (
                            <td key={pi} className="px-4 py-3 font-mono" style={{ color: PILLAR_COLORS[pi] }}>
                              {fmt(v)}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <span className="font-mono font-medium" style={{ color: tier.color }}>{fmt(r.fs)}</span>
                            <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden w-20">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${(r.fs / 5 * 100).toFixed(1)}%`, backgroundColor: tier.color }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3"><TierBadge score={r.fs} /></td>
                        </tr>

                        {isOpen && detail && (
                          <tr className="border-t border-white/5">
                            <td colSpan={7} className="px-0 py-0">
                              <div
                                className="grid grid-cols-2 gap-0 border-b border-white/5"
                                style={{ background: 'rgba(181,157,242,0.06)' }}
                              >
                                {/* Key Market Stats */}
                                <div className="px-6 py-5 border-r border-white/10">
                                  <div className="text-[10px] uppercase tracking-widest font-bold text-brand-accent mb-4">
                                    Key Market Stats
                                  </div>
                                  <div className="space-y-2.5">
                                    {detail.stats.map(stat => (
                                      <div key={stat.label} className="flex items-baseline gap-2">
                                        <span className="text-xs text-brand-mint/50 whitespace-nowrap">{stat.label}</span>
                                        <span className="flex-1 border-b border-dotted border-white/10 mb-0.5" />
                                        <span className="text-xs font-semibold text-brand-mint whitespace-nowrap">{stat.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Strategic Context */}
                                <div className="px-6 py-5">
                                  <div className="text-[10px] uppercase tracking-widest font-bold text-brand-accent mb-4">
                                    Strategic Context
                                  </div>
                                  <p className="text-xs text-brand-mint/70 leading-relaxed mb-5">
                                    {detail.context}
                                  </p>
                                  <div className="flex items-center gap-5">
                                    <button className="text-[10px] uppercase tracking-widest font-bold text-brand-accent hover:text-brand-accent/70 transition-colors">
                                      Download Dossier
                                    </button>
                                    <button className="text-[10px] uppercase tracking-widest font-bold text-brand-accent hover:text-brand-accent/70 transition-colors">
                                      View Competitors
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bar chart */}
            <div className="bg-brand-card rounded-2xl border border-white/10 p-5">
              <div className="text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold mb-4">
                Score Comparison
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 60 }}>
                  <XAxis
                    type="number" domain={[0, 5]}
                    tick={{ fill: 'rgba(219,226,255,0.3)', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(219,226,255,0.1)' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category" dataKey="name" width={55}
                    tick={{ fill: 'rgba(219,226,255,0.7)', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#33183d',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: '#dbe2ff',
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [v.toFixed(2), 'Final Score']}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW COUNTRY SCORER ────────────────────────────────────────────── */}
      {activeTab === 'generic' && (
        <div className="space-y-5">
          <WeightStrip
            weights={genericWeights}
            onChange={setGenericWeights}
            onReset={() => setGenericWeights({ ...DEFAULT_W })}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
            <div className="space-y-5">
              {[1, 2, 3].map(p => (
                <div key={p} className="bg-brand-card rounded-2xl border border-white/10 p-5">
                  <div
                    className="text-[10px] uppercase tracking-widest font-bold mb-4 pb-3 border-b"
                    style={{ color: PILLAR_COLORS[p-1], borderColor: `${PILLAR_COLORS[p-1]}40` }}
                  >
                    Pillar {p} - {[
                      'Commercial & Clinical Attractiveness',
                      'Regulatory & Market Access',
                      'Operational Feasibility',
                    ][p-1]}
                  </div>
                  {CONSTITUENTS.filter(c => c.pillar === p).map(c => (
                    <ConstituentSlider
                      key={c.id}
                      constituent={c}
                      value={genScores[c.id]}
                      onChange={val => setGenScores(prev => ({ ...prev, [c.id]: val }))}
                      color={PILLAR_COLORS[p-1]}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Result panel */}
            <div className="bg-brand-card rounded-2xl border border-white/10 p-5 sticky top-6">
              <div className="text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold mb-4">
                Calculated Score
              </div>
              <div className="font-display text-7xl font-light text-brand-mint leading-none mb-2">
                {fmt(genFinal)}
              </div>
              <div className="text-xs text-brand-mint/40 mb-3">out of 5.00</div>
              <TierBadge score={genFinal} />

              <div className="border-t border-white/10 mt-5 pt-4 space-y-3">
                {[
                  { label:'Commercial avg.', val: genP1, wt: genericWeights.w1, color: PILLAR_COLORS[0] },
                  { label:'Regulatory avg.', val: genP2, wt: genericWeights.w2, color: PILLAR_COLORS[1] },
                  { label:'Operational avg.',val: genP3, wt: genericWeights.w3, color: PILLAR_COLORS[2] },
                ].map(({ label, val, wt, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-brand-mint/60">{label}</div>
                      <div className="text-[10px] text-brand-mint/30 font-mono">weight: {wt}%</div>
                    </div>
                    <span className="font-mono text-base font-medium" style={{ color }}>{fmt(val)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 mt-5 pt-4">
                <div className="text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold mb-3 px-1">Actions</div>
                <div className="space-y-3">
                  <input 
                    type="text"
                    placeholder="Country Name..."
                    value={newCountryName}
                    onChange={(e) => setNewCountryName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-accent/50 placeholder:text-brand-mint/20"
                  />
                  <button 
                    onClick={() => {
                        if (!newCountryName.trim()) {
                            alert("Please enter a country name.");
                            return;
                        }
                        if (data.some(c => c.name.toLowerCase() === newCountryName.toLowerCase())) {
                            alert("A market with this name already exists.");
                            return;
                        }
                        setData(prev => [...prev, { name: newCountryName, s: { ...genScores } }]);
                        setNewCountryName('');
                        setActiveTab('ranking');
                    }}
                    className="w-full bg-brand-accent text-brand-bg py-3 rounded-xl font-bold text-xs hover:scale-[1.02] transition-all shadow-lg shadow-brand-accent/20"
                  >
                    Save to Ranking
                  </button>
                </div>
              </div>

              <div className="border-t border-white/10 mt-5 pt-4">
                <div className="text-[10px] uppercase tracking-widest text-brand-mint/40 font-bold mb-3">Tier Guide</div>
                {[
                  { range:'≥ 4.0',   label:'Tier 1 - Priority',   color:'#b59df2' },
                  { range:'3.4-3.9', label:'Tier 2 - Secondary',  color:'#60a5fa' },
                  { range:'3.0-3.3', label:'Tier 3 - Long-term',  color:'#fbbf24' },
                  { range:'< 3.0',   label:'Tier 4 - Avoid',      color:'#E8604C' },
                ].map(t => (
                  <div key={t.label} className="flex items-center gap-2 text-xs mb-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-brand-mint/40 font-mono">{t.range}</span>
                    <span className="text-brand-mint/50">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
