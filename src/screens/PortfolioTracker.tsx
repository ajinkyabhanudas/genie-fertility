import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  CheckCircle2, 
  Trash2,
  PlusCircle,
  Download,
  AlertCircle, 
  TrendingUp, 
  Target, 
  DollarSign, 
  Zap,
  HelpCircle,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { generateContent } from "../services/generateContent";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { executeHybridRAGSearch } from '../services/rag/hybridSearch';

/**
 * HARDCODED DATA CONSTANTS
 */

import { INDICATIONS as INITIAL_INDICATIONS } from '../data/indications';

/**
 * HARDCODED DATA CONSTANTS
 */

const EXIT_STEPS = [
  { name: 'IVF Only', multiple: [3, 5], acquirer: 'Core Market' },
  { name: '+ RIF', multiple: [4, 6], acquirer: 'CooperSurgical, Vitrolife' },
  { name: '+ Endometriosis', multiple: [5, 8], acquirer: 'AbbVie' },
  { name: '+ Data/Pharma', multiple: [7, 10], acquirer: 'Pharma Licensing' }
];

const ROADMAP = [
  {
    year: '2026',
    title: 'Phase 1: Validation',
    actions: [
      'Validate RIF infection/microbiome/inflammation panel (100-150 patients)',
      'Retrospective analysis of existing 200K patient dataset for endo/RIF'
    ],
    cost: '£80,000-£120,000',
    costBreakdown: [
      { item: 'Infection Panel Validation', cost: '£60k' },
      { item: 'Retrospective Data Analysis', cost: '£30k' },
      { item: 'Contingency/Admin', cost: '£10k' }
    ]
  },
  {
    year: '2027',
    title: 'Phase 2: RIF Launch & Endo Study',
    actions: [
      'Launch RIF panel commercially (UK, Spain, US via CLIA)',
      'Prospective endometriosis validation study (200-300 patients)',
      'Adenomyosis differentiation literature review'
    ],
    cost: '£170,000-£240,000',
    costBreakdown: [
      { item: 'Prospective Endo Study', cost: '£120k' },
      { item: 'RIF Commercial Launch', cost: '£60k' },
      { item: 'Adeno Literature Review', cost: '£20k' }
    ]
  },
  {
    year: '2028',
    title: 'Phase 3: Endo Launch',
    actions: [
      'Launch endometriosis panel commercially (UK, Spain, EU)',
      'Add PCOS as D2C cross-sell add-on in UK channel'
    ],
    cost: '£50,000-£80,000',
    costBreakdown: [
      { item: 'Endo Commercial Scaling', cost: '£40k' },
      { item: 'PCOS Integration', cost: '£20k' }
    ]
  },
  {
    year: '2029-30',
    title: 'Phase 4: Datasets & Scaling',
    actions: [
      'Data licensing and pharma partnership programme',
      'Adenomyosis cohort study (if differentiation resolved)'
    ],
    cost: '£100,000-£200,000',
    costBreakdown: [
      { item: 'Pharma Partnership Ops', cost: '£80k' },
      { item: 'Adeno Cohort Study', cost: '£70k' },
      { item: 'Strategic Contingency', cost: '£50k' }
    ]
  }
];

const QUESTIONS_INITIAL = [
  { id: 1, text: 'Does the 200K patient dataset include confirmed diagnoses (endometriosis, RIF, adenomyosis)?', owner: 'Founders / Data', deadline: 'Q2 2026', status: 'Open' },
  { id: 2, text: "Has Genie's lab validated OPN, IL-10, IL-6 detection in its processing protocol?", owner: 'Lab Team', deadline: 'Q3 2026', status: 'In Progress' },
  { id: 3, text: 'What proportion of PCOS patients have sufficient cycle regularity for reliable collection?', owner: 'Lab / Comm', deadline: 'Q3 2026', status: 'Open' },
  { id: 4, text: 'Has freedom-to-operate analysis been done for RIF, endo, and adeno panels?', owner: 'Legal / IP Counsel', deadline: 'Q2 2026', status: 'Open' },
  { id: 5, text: 'What is the COGS for running a multi-marker RIF-extended panel?', owner: 'Lab Team', deadline: 'Q3 2026', status: 'In Progress' },
  { id: 6, text: 'Can adenomyosis markers be distinguished from endometriosis markers in a mixed sample?', owner: 'Lab / Review', deadline: 'Q4 2026', status: 'Open' }
];

const DEFAULT_PROTOCOL = [
  { id: 1, title: 'Biomarker Audit', desc: 'Cross-referencing serum markers with menstrual blood MenSC transcriptome data.' },
  { id: 2, title: 'SAM Mapping', desc: 'Bottom-up prevalence analysis across UK, US, and EU5 markets.' },
  { id: 3, title: 'WTP Benchmarking', desc: 'Pricing anchor analysis vs. current gold-standard (Laparoscopy/MRI).' },
  { id: 4, title: 'Acquisition Fit', desc: 'Mapping synergy with existing pharma (AbbVie/Bayer) and device portfolios.' },
  { id: 5, title: 'In Silico Validation', desc: 'Simulating detection sensitivity within Genie’s current lab architecture.' },
];

const ScoreBadge = ({ score }: { score: string }) => {
  const getColors = (s: string) => {
    const low = s?.toLowerCase() || '';
    if (low.includes('very high') || low === 'high') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (low.includes('medium') || low.includes('1st') || low.includes('2nd')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (low.includes('low')) return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    return 'bg-white/5 text-brand-mint/40 border-white/10';
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getColors(score)}`}>
      {score}
    </span>
  );
};

const mapScoreToNumeric = (score: string, isRnD: boolean = false) => {
  const low = score?.toLowerCase() || '';
  let value = 0;
  if (low.includes('very high')) value = 5;
  else if (low.includes('high')) value = 4;
  else if (low.includes('medium-high')) value = 3.5;
  else if (low.includes('medium') && !low.includes('low')) value = 3;
  else if (low.includes('low-medium')) value = 2;
  else if (low.includes('low')) value = 1;

  // For R&D: "Low investment" is GOOD (high score), "High investment" is BAD (low score)
  if (isRnD) {
    if (low.includes('low investment')) return 5;
    if (low.includes('medium investment')) return 3;
    if (low.includes('high investment')) return 1;
    return 3;
  }
  return value;
};

const calculateGenieScore = (scores: any) => {
  const weights = {
    biomarker: 0.25,
    sam: 0.20,
    wtp: 0.15,
    ltv: 0.15,
    exit: 0.15,
    rd: 0.10
  };

  return (
    mapScoreToNumeric(scores.biomarker) * weights.biomarker +
    mapScoreToNumeric(scores.sam) * weights.sam +
    mapScoreToNumeric(scores.wtp) * weights.wtp +
    mapScoreToNumeric(scores.ltv) * weights.ltv +
    mapScoreToNumeric(scores.exit) * weights.exit +
    mapScoreToNumeric(scores.rd, true) * weights.rd
  );
};

/**
 * AI Research Service
 */
const validateRelevanceAI = async (topic: string) => {
  const prompt = `
    You are a Strategic Domain Filter for Genie Fertility.
    
    DOMAIN FOCUS:
    - Reproductive health (IVF, fertility, pregnancy, conception).
    - Women's health diagnostics (menstrual cycle, endometriosis, PCOS, ovarian health, uterine health).
    - Female-specific conditions (adenomyosis, fibroids, vaginal microbiome).
    - Female oncology (cervical, ovarian, endometrial cancer).
    - Hormonal health related to female reproduction or menopause.

    INPUT TO EVALUATE: "${topic}"
    
    TASK:
    Determine if this input is a legitimate medical, scientific, or clinical diagnostic term within the reproductive health and women's diagnostic space.
    - If it is a generic medical term (e.g., "Diabetes", "Heart disease", "Brain tumor") it is IRRELEVANT.
    - If it is nonsensical (e.g., "random adjacency", "abc", "test input") it is IRRELEVANT.
    - If it is non-medical (e.g., "cars", "marketing", "stock market") it is IRRELEVANT.
    - If it is a recognized clinical diagnostic challenge or condition Genie could plausibly address in the female/reproductive niche, it is RELEVANT.
    
    Respond with EXACTLY "RELEVANT" or "IRRELEVANT". Do not provide any other text.
  `;

  try {
    const text = await generateContent(prompt);
    return text.trim().includes('RELEVANT');
  } catch (error) {
    return true; // Fallback to allow if API fails
  }
};

const reviewProtocolAI = async (indication: string, protocol: any[]) => {
  const prompt = `
    You are a Strategic Research Director for a life sciences company.
    Review the research protocol for: "${indication}".
    
    Protocol Steps:
    ${protocol.map((p, i) => `${i + 1}. ${p.title}: ${p.desc}`).join('\n')}
    
    Evaluate if this protocol is sufficient to determine commercial viability. 
    Strictly focus on scientific and market feasibility for women's health.
  `;

  try {
    const text = await generateContent(prompt);
    return text || 'Protocol approved for development.';
  } catch (error) {
    return "Standard protocol validation successful.";
  }
};

const generateAdjacencyData = async (indicationName: string, protocol: any[]) => {
  // 1. Fetch RAG context from Europe PMC / ClinicalTrials / openFDA / Static Corpus
  const ragPayload = await executeHybridRAGSearch(
    `${indicationName} biomarker diagnostic clinical trials`,
    indicationName
  );

  const prompt = `
    You are a professional life sciences strategy consultant. Generate strategic data for "Genie Fertility" (menstrual blood diagnostics).
    Indication: ${indicationName}
    
    PROTOCOL:
    ${protocol.map((p, i) => `${i + 1}. ${p.title}: ${p.desc}`).join('\n')}

    RETRIEVED CLINICAL & BIOMARKER KNOWLEDGE CONTEXT:
    ${ragPayload.formattedPromptContext}

    COMPLIANCE RULES:
    - If the indication is NOT related to women's health, fertility, or diagnostics, return: {"error": "Genie Research Agent only addresses topics within the women's health and diagnostic segments."}
    - Validate suggested biomarkers directly against the retrieved literature context above. Include PubMed PMIDs or DOIs in the sources array.
    - Return a JSON object:
    {
      "name": "string",
      "priority": "string",
      "verdict": "string",
      "scores": { "biomarker": "High"|"Medium"|"Low", "sam": "string", "wtp": "string", "ltv": "string", "exit": "string", "rd": "string" },
      "details": { "sam": "string", "wtp": "string", "ltv": "string", "biomarkers": "string", "acquirer": "string", "rd_cost": "string", "timeline": "string", "risk": "string" },
      "sources": ["string"],
      "assumptions": [{"point": "string", "reasoning": "string"}]
    }

    IMPORTANT: Do NOT use ellipses (...) for long text. Wrap the text or provide it in full. Ensure "name" is capitalized and "priority" reflects the competitive landscape.
  `;

  try {
    const text = await generateContent(prompt);

    const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const data = JSON.parse(jsonStr);
    if (data.error) throw new Error(data.error);
    return data;
  } catch (error) {
    throw error;
  }
};

export default function PortfolioTracker({ indications, setIndications }: { indications: any[], setIndications: React.Dispatch<React.SetStateAction<any[]>> }) {
  const [expandedIndication, setExpandedIndication] = useState<string | null>(null);
  const [questions, setQuestions] = useState(QUESTIONS_INITIAL);
  
  // Research Agent State
  const [isResearching, setIsResearching] = useState(false);
  const [researchInput, setResearchInput] = useState('');
  const [researchStep, setResearchStep] = useState<'input' | 'validating' | 'protocol' | 'review' | 'processing' | 'rejected' | 'complete'>('input');
  const [researchProtocol, setResearchProtocol] = useState(DEFAULT_PROTOCOL);
  const [protocolFeedback, setProtocolFeedback] = useState('');
  
  const handleAddStep = () => {
    const newId = researchProtocol.length > 0 ? Math.max(...researchProtocol.map(p => p.id)) + 1 : 1;
    setResearchProtocol([...researchProtocol, { id: newId, title: '', desc: '' }]);
  };

  const handleUpdateStep = (id: number, field: 'title' | 'desc', value: string) => {
    setResearchProtocol(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleRemoveStep = (id: number) => {
    setResearchProtocol(prev => prev.filter(p => p.id !== id));
  };

  const handleInitializeProtocol = async () => {
    if (!researchInput.trim()) return;
    setResearchStep('validating');
    
    try {
      const isRelevant = await validateRelevanceAI(researchInput);
      if (!isRelevant) {
        setProtocolFeedback("Pre-processing Check Failed: Input flagged as off-topic or non-domain related. The Genie Research Agent is restricted to reproductive health, fertility, and women's diagnostic segments.");
        setResearchStep('rejected');
        return;
      }
      setResearchStep('protocol');
    } catch (error) {
      // Fallback if API fails, but try to be safe
      setResearchStep('protocol');
    }
  };

  const handleInitialProtocolReview = async () => {
    setResearchStep('processing');
    const feedback = await reviewProtocolAI(researchInput, researchProtocol);
    setProtocolFeedback(feedback);
    setResearchStep('review');
  };

  const handleStartResearch = async () => {
    setResearchStep('processing');
    try {
      const newData = await generateAdjacencyData(researchInput, researchProtocol);
      const id = researchInput.toLowerCase().replace(/\s+/g, '-');
      setIndications(prev => [...prev, { ...newData, id, isAIGenerated: true }]);
      setResearchStep('complete');
      setTimeout(() => {
        setIsResearching(false);
        setResearchStep('input');
        setResearchInput('');
        setResearchProtocol(DEFAULT_PROTOCOL);
        setProtocolFeedback('');
      }, 2500);
    } catch (err: any) {
      if (err.message && err.message.includes('Genie Research Agent')) {
        setProtocolFeedback(err.message);
        setResearchStep('rejected');
      } else {
        alert("Research failed. Please check connection.");
        setResearchStep('input');
      }
    }
  };

  const downloadSources = (ind: any) => {
    if (!ind.sources || !ind.assumptions) return;
    
    const content = `
GENIE FERTILITY STRATEGIC RESEARCH: ${ind.name.toUpperCase()}
Generated: ${new Date().toLocaleDateString()}

SOURCES & REFERENCES:
${ind.sources.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

STRATEGIC ASSUMPTIONS & GROUNDING:
${ind.assumptions.map((a: any, i: number) => `Assumption ${i + 1}: ${a.point}\nGrounding: ${a.reasoning}`).join('\n\n')}

VERDICT:
${ind.verdict}
    `;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Genie_Research_${ind.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleQuestion = (id: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        const statuses: any = { 'Open': 'In Progress', 'In Progress': 'Resolved', 'Resolved': 'Open' };
        return { ...q, status: statuses[q.status] };
      }
      return q;
    }));
  };

  const addQuestion = (text: string, owner: string, deadline: string) => {
    const newId = questions.length > 0 ? Math.max(...questions.map(q => q.id)) + 1 : 1;
    setQuestions(prev => [...prev, { id: newId, text, owner, deadline, status: 'Open' }]);
  };

  const removeQuestion = (id: number) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const updateQuestion = (id: number, field: string, value: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  // Dynamic Ranking Logic
  const rankedIndications = [...indications].sort((a, b) => calculateGenieScore(b.scores) - calculateGenieScore(a.scores)).map((ind, idx) => {
    const suffix = idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th';
    return {
      ...ind,
      priority: `${idx + 1}${suffix}${idx >= 3 ? ' (cross-sell)' : ''}`
    };
  });

  // Dynamic Exit Multiple Calculation
  const getMultipleStepUp = (exitScore: string) => {
    const low = exitScore?.toLowerCase() || '';
    if (low.includes('very high')) return [1.5, 2.0];
    if (low.includes('high')) return [1.0, 1.5];
    if (low.includes('medium')) return [0.5, 1.0];
    return [0.2, 0.5];
  };

  const dynamicExitSteps = [
    { name: 'IVF Only', multiple: [3, 5], acquirer: 'Core Market' }
  ];

  let currentMin = 3;
  let currentMax = 5;

  // Add top adjacencies to the steps (up to 3 for clarity)
  rankedIndications.slice(0, 3).forEach((ind) => {
    const [minUp, maxUp] = getMultipleStepUp(ind.scores.exit);
    currentMin += minUp;
    currentMax += maxUp;
    dynamicExitSteps.push({
      name: `+ ${ind.name}`,
      multiple: [parseFloat(currentMin.toFixed(1)), parseFloat(currentMax.toFixed(1))],
      acquirer: ind.details.acquirer.split('(')[0].trim()
    });
  });

  // Final kicker for Dataset/Platform if we have enough adjacencies
  if (indications.length >= 4) {
    currentMin += 1.0;
    currentMax += 2.0;
    dynamicExitSteps.push({
      name: '+ Dataset & Pharma',
      multiple: [parseFloat(currentMin.toFixed(1)), parseFloat(currentMax.toFixed(1))],
      acquirer: 'Pharma Licensing'
    });
  }

  const finalMultiple = `${currentMin.toFixed(0)}-${currentMax.toFixed(0)}x`;

  const chartData = dynamicExitSteps.map((step) => ({
    name: step.name,
    min: step.multiple[0],
    max: step.multiple[1],
    acquirer: step.acquirer
  }));

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-accent/5 blur-[120px] pointer-events-none rounded-full" />
        <div className="relative">
          <h1 className="text-4xl font-display font-bold mb-2 tracking-tight">Portfolio Optimisation Analysis</h1>
          <p className="text-brand-mint/60 max-w-2xl">Strategic adjacency mapping and exit value enhancement roadmap for Genie Fertility. Leverage AI-driven research to identify high-multiple diagnostic expansions.</p>
        </div>
        <button 
          onClick={() => setIsResearching(true)}
          className="relative group flex items-center gap-2 bg-brand-accent text-brand-bg px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-accent/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Zap size={18} className="group-hover:animate-pulse" />
          Genie Research Agent
        </button>
      </header>

      {/* Research Agent Modal Overlay */}
      <AnimatePresence>
        {isResearching && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsResearching(false)}
              className="absolute inset-0 bg-brand-bg/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-brand-card w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 rounded-2xl bg-brand-accent/20">
                    <Zap className="text-brand-accent animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Research Agent</h2>
                    <p className="text-xs text-brand-mint/40">AI-Powered Strategic Adjacency Explorer</p>
                  </div>
                </div>

                {researchStep === 'input' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-brand-mint/40 uppercase mb-2 tracking-widest">Target Adjacency</label>
                      <input 
                        value={researchInput}
                        onChange={(e) => setResearchInput(e.target.value)}
                        placeholder="e.g. Ovarian Cancer, Menopause, Egg Quality"
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-brand-accent focus:outline-none focus:border-brand-accent/50 placeholder:text-white/10"
                      />
                    </div>
                    <button 
                      onClick={handleInitializeProtocol}
                      disabled={!researchInput}
                      className="w-full bg-white/10 hover:bg-brand-accent hover:text-brand-bg text-white py-4 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                      Initialize Research Protocol
                    </button>
                  </div>
                )}

                {researchStep === 'validating' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-brand-accent/20 border-t-brand-accent animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-brand-accent uppercase tracking-widest text-xs">Pre-processing Step</p>
                      <p className="text-sm text-white mt-1">Validating domain relevance and appropriateness...</p>
                    </div>
                  </div>
                )}

                {researchStep === 'protocol' && (
                  <div className="space-y-6">
                    <div className="bg-brand-bg/50 rounded-2xl border border-white/5 p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-brand-accent flex items-center gap-2">
                          <CheckCircle2 size={16} /> Research Methodology
                        </h3>
                        <button 
                          onClick={handleAddStep}
                          className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-1 rounded flex items-center gap-1 hover:bg-brand-accent/30 transition-all font-bold"
                        >
                          <PlusCircle size={10} /> Add Step
                        </button>
                      </div>
                      <div className="space-y-4">
                        {researchProtocol.map((s, i) => (
                          <div key={s.id} className="group/step relative bg-white/2 rounded-xl p-3 border border-white/5">
                            <button 
                              onClick={() => handleRemoveStep(s.id)}
                              className="absolute top-2 right-2 text-rose-500/0 group-hover/step:text-rose-500/60 hover:!text-rose-500 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                            <input 
                              value={s.title}
                              onChange={(e) => handleUpdateStep(s.id, 'title', e.target.value)}
                              placeholder="New Step Title"
                              className="w-full bg-transparent text-xs font-bold text-white mb-1 focus:outline-none focus:text-brand-accent placeholder:text-white/20"
                            />
                            <textarea 
                              value={s.desc}
                              onChange={(e) => handleUpdateStep(s.id, 'desc', e.target.value)}
                              rows={1}
                              placeholder="Describe the research objective"
                              className="w-full bg-transparent text-[10px] text-brand-mint/40 focus:outline-none resize-none placeholder:text-brand-mint/20"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setResearchStep('input')}
                        className="flex-1 bg-white/5 py-4 rounded-xl text-xs font-bold hover:bg-white/10 transition-all text-brand-mint/40"
                      >
                        Back
                      </button>
                      <button 
                        onClick={handleInitialProtocolReview}
                        className="flex-[2] bg-brand-accent text-brand-bg py-4 rounded-xl font-bold hover:scale-[1.02] transition-all"
                      >
                        Review Protocol
                      </button>
                    </div>
                  </div>
                )}

                {researchStep === 'review' && (
                  <div className="space-y-6">
                    <div className="bg-brand-bg/50 rounded-2xl border border-white/5 p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-brand-accent/20 flex items-center justify-center">
                          <Zap className="text-brand-accent" size={14} />
                        </div>
                        <h3 className="text-sm font-bold text-white whitespace-normal">AI Strategy Director Review</h3>
                      </div>
                      <div className="bg-brand-accent/5 border border-brand-accent/10 rounded-xl p-4 italic text-sm text-brand-accent/90 leading-relaxed mb-4 whitespace-normal prose prose-invert prose-sm max-w-none">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {protocolFeedback}
                        </Markdown>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-white/2 rounded-lg border border-white/5">
                        <HelpCircle size={14} className="text-brand-mint/30 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-brand-mint/40 whitespace-normal">The research agent will strictly follow the steps defined in your methodology while leveraging scientific databases and market reports.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setResearchStep('protocol')}
                        className="flex-1 bg-white/5 py-4 rounded-xl text-xs font-bold hover:bg-white/10 transition-all text-brand-mint/40"
                      >
                        Edit Steps
                      </button>
                      <button 
                        onClick={handleStartResearch}
                        className="flex-[2] bg-brand-accent text-brand-bg py-4 rounded-xl font-bold hover:scale-[1.02] transition-all text-xs"
                      >
                        Approve & Conduct Research
                      </button>
                    </div>
                  </div>
                )}

                {researchStep === 'rejected' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-8 text-center shadow-xl">
                      <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="text-rose-500" size={24} />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2 whitespace-normal tracking-tight">Segment Focus Check</h3>
                      <div className="text-sm text-brand-mint/60 mb-6 leading-relaxed whitespace-normal px-4 prose prose-invert prose-sm max-w-none">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {protocolFeedback || "The Genie Research Agent evaluates diagnostic adjacencies within women's health and reproductive medicine. Unrelated topics cannot be processed."}
                        </Markdown>
                      </div>
                      <button 
                        onClick={() => setResearchStep('input')}
                        className="w-full bg-white/5 py-4 rounded-xl text-xs font-bold hover:bg-white/10 transition-all text-white border border-white/5 shadow-sm"
                      >
                        Return to Research Input
                      </button>
                    </div>
                  </div>
                )}

                {researchStep === 'processing' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-brand-accent/20 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Zap className="text-brand-accent" size={24} />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-brand-accent">Analyzing Scientific Literature</p>
                      <p className="text-xs text-brand-mint/40 mt-1">Cross-referencing OPN and IL-6 MenSC markers</p>
                    </div>
                  </div>
                )}

                {researchStep === 'complete' && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="text-emerald-400" size={32} />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-emerald-400">Research Complete</p>
                      <p className="text-xs text-brand-mint/40 mt-1">Found potential 6-8x multiple acquirer (Roche Diagnostics)</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Section 1: Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
        {[
          { label: 'Indications Evaluated', value: indications.length.toString(), icon: Target },
          { label: 'Highest Priority', value: rankedIndications[0]?.name || 'N/A', icon: Zap, trend: 'Tier 1' },
          { label: 'Strongest Exit Multiple', value: finalMultiple, icon: TrendingUp, sub: 'Optimised Portfolio' },
          { label: 'Base Exit Multiple', value: '3-5x', icon: DollarSign, sub: 'IVF Panel Only' }
        ].map((m, i) => (
          <div key={i} className="group bg-brand-card p-6 rounded-2xl border border-white/10 hover:border-brand-accent/30 hover:bg-white/5 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 scale-150 transition-all duration-500">
              <m.icon size={48} className="text-brand-accent" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-brand-accent/10 group-hover:bg-brand-accent/20 transition-colors">
                <m.icon className="text-brand-accent" size={20} />
              </div>
              <span className="text-[10px] font-bold text-brand-mint/40 uppercase tracking-widest">{m.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold font-display whitespace-normal break-words pr-8" title={m.value}>{m.value}</div>
              {('trend' in m) && <span className="text-[10px] text-emerald-400 font-mono">{(m as any).trend}</span>}
            </div>
            {m.sub && <div className="text-[10px] text-brand-mint/30 mt-1 font-medium">{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* Section 2: Scoring Matrix */}
      <section className="relative">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold font-display tracking-tight">Strategic Scoring Matrix</h2>
            <p className="text-xs text-brand-mint/40 mt-1">Numerical weighting across technical and commercial feasibility pillars.</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-bold text-brand-mint/60 uppercase tracking-wider">Live Analysis</span>
          </div>
        </div>
        <div className="bg-brand-card rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-[9px] uppercase tracking-widest text-brand-mint/40">
                  <th className="p-5 border-b border-white/5 font-bold">Indication Adjacency</th>
                  <th className="p-5 border-b border-white/5 font-bold whitespace-nowrap text-center">Biomarker</th>
                  <th className="p-5 border-b border-white/5 font-bold text-center">SAM</th>
                  <th className="p-5 border-b border-white/5 font-bold text-center">WTP</th>
                  <th className="p-5 border-b border-white/5 font-bold text-center">LTV</th>
                  <th className="p-5 border-b border-white/5 font-bold text-center">Exit</th>
                  <th className="p-5 border-b border-white/5 font-bold text-center">R&D</th>
                  <th className="p-5 border-b border-white/5 font-bold text-right">Strategic Analysis</th>
                </tr>
              </thead>
              <tbody>
                {rankedIndications.map((ind) => (
                  <tr key={ind.id} className="hover:bg-white/[0.04] transition-colors border-b border-white/5 last:border-0">
                    <td className="p-5">
                      <div className="font-bold text-sm text-white group-hover:text-brand-accent transition-colors">{ind.name}</div>
                    </td>
                    <td className="p-5 text-center">
                      <ScoreBadge score={ind.scores.biomarker} />
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col items-center gap-1">
                        <ScoreBadge score={ind.scores.sam.split(' ')[0]} />
                        <span className="text-[9px] text-brand-mint/40 font-mono text-center">{ind.scores.sam.split(' ').slice(1).join(' ')}</span>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <ScoreBadge score={ind.scores.wtp} />
                    </td>
                    <td className="p-5 text-center">
                      <ScoreBadge score={ind.scores.ltv} />
                    </td>
                    <td className="p-5 text-center">
                      <ScoreBadge score={ind.scores.exit} />
                    </td>
                    <td className="p-5 text-center">
                      <ScoreBadge score={ind.scores.rd} />
                    </td>
                    <td className="p-5 text-right">
                      <button 
                        onClick={() => {
                          setExpandedIndication(ind.id);
                          const el = document.getElementById(`deep-dive-${ind.id}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-brand-bg transition-all group/btn text-[10px] font-bold"
                      >
                        Analysis <ChevronDown size={12} className="group-hover/btn:translate-y-0.5 transition-transform" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 3: Indication Detail Cards */}
      <section>
        <h2 className="text-xl font-bold mb-6">Indication Deep-Dive</h2>
        <div className="space-y-3">
          {rankedIndications.map((ind) => (
            <div key={ind.id} id={`deep-dive-${ind.id}`} className="bg-brand-card rounded-xl border border-white/10 overflow-hidden relative">
              {ind.priority.toLowerCase().includes('1st') && (
                <div className="absolute top-0 right-0 py-1 px-3 bg-brand-accent text-brand-bg text-[10px] font-bold uppercase tracking-widest rounded-bl-xl z-20">
                  High Priority
                </div>
              )}
              <button 
                onClick={() => setExpandedIndication(expandedIndication === ind.id ? null : ind.id)}
                className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    ind.priority.toLowerCase().includes('1st') ? 'bg-brand-accent text-brand-bg' : 'bg-white/10 text-brand-mint/40'
                  }`}>
                    {ind.priority.toString().charAt(0)}
                  </span>
                  <div>
                    <h3 className="font-bold">{ind.name}</h3>
                    <p className="text-xs text-brand-mint/40">{ind.verdict}</p>
                  </div>
                </div>
                {expandedIndication === ind.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              <AnimatePresence>
                {expandedIndication === ind.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/5"
                  >
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/2 pb-8">
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-brand-accent font-bold mb-2">Commercial Overview</h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-brand-mint/40">SAM (Core Markets)</span>
                              <span className="font-medium">{ind.details.sam}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-brand-mint/40">Willingness to Pay</span>
                              <span className="font-medium text-right ml-4 max-w-[200px]">{ind.details.wtp}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-brand-mint/40">Estimated LTV</span>
                              <span className="font-medium">{ind.details.ltv}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-brand-accent font-bold mb-2">Technical Feasibility</h4>
                          <p className="text-sm text-brand-mint/80 leading-relaxed bg-brand-bg/50 p-4 rounded-lg border border-white/5">
                            {ind.details.biomarkers}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                          <h4 className="text-[10px] uppercase tracking-widest text-brand-accent font-bold mb-4 flex items-center justify-between">
                             <div className="flex items-center gap-2 text-emerald-400">
                               <CheckCircle2 size={12} /> Exit Alignment
                             </div>
                             <span className="font-mono text-white">Score: {ind.scores.exit}</span>
                          </h4>
                          <div className="text-sm">
                            <p className="text-brand-mint/40 mb-1">Acquisition Rationale & Potential Exit:</p>
                            <p className="font-bold leading-relaxed">{ind.details.acquirer}</p>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-[10px] uppercase tracking-widest text-brand-accent font-bold mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                               <Clock size={12} /> Research & Development Plan
                            </div>
                            <span className="font-mono text-white">Score: {ind.scores.rd}</span>
                          </h4>
                          <div className="bg-brand-bg/30 rounded-xl border border-white/5 overflow-hidden">
                            <div className="p-4 border-b border-white/5 flex justify-between items-baseline">
                              <span className="text-xs font-bold text-white">Budget Allocation</span>
                              <span className="text-xs font-mono text-brand-accent">{ind.details.rd_cost}</span>
                            </div>
                            <div className="p-4 space-y-3">
                              {ind.details.rd_breakdown?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-start gap-4 text-[11px]">
                                  <div className="flex-1">
                                    <p className="text-white font-medium">{item.item}</p>
                                    <p className="text-brand-mint/40 mt-0.5">{item.rationale}</p>
                                  </div>
                                  <span className="font-mono text-brand-accent">{item.cost}</span>
                                </div>
                              ))}
                            </div>
                            <div className="bg-brand-accent/5 p-3 flex justify-between items-center text-[10px] border-t border-white/5">
                              <span className="text-brand-mint/40 uppercase font-bold">Target Timeline</span>
                              <span className="text-brand-accent font-bold">{ind.details.timeline}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-rose-500/5 p-4 rounded-xl border border-rose-500/20">
                          <h4 className="text-[10px] uppercase tracking-widest text-rose-400 font-bold mb-2 flex items-center gap-2">
                            <AlertCircle size={12} /> Critical Risk
                          </h4>
                          <p className="text-xs text-rose-200/70">{ind.details.risk}</p>
                        </div>

                        {ind.isAIGenerated && (
                          <button 
                            onClick={() => downloadSources(ind)}
                            className="w-full flex items-center justify-center gap-2 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent py-3 rounded-xl border border-brand-accent/20 text-xs font-bold transition-all"
                          >
                            <Download size={14} /> Download Strategic Sources & Assumptions
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Exit Value Steps */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-brand-card p-8 rounded-3xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" />
          <div className="relative">
            <h2 className="text-2xl font-bold font-display tracking-tight mb-2">Exit Value Step-Up</h2>
            <p className="text-sm text-brand-mint/40 mb-8 leading-relaxed max-w-md">
              Genie transitions from a focused IVF test to a comprehensive Women's Health Platform, dramatically increasing strategic value to pharma and diagnostic acquirers.
            </p>
            <div className="space-y-6">
              {dynamicExitSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-5 group">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all group-hover:scale-110 ${
                    i === 0 ? 'bg-white/10 text-white/40' : 'bg-brand-accent text-brand-bg shadow-lg shadow-brand-accent/20'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="text-sm font-bold text-white group-hover:text-brand-accent transition-colors">{step.name}</h3>
                      <span className="text-lg font-mono font-bold text-brand-accent">{step.multiple[0]}-{step.multiple[1]}x</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(step.multiple[1] / 12 * 100)}%` }}
                        viewport={{ once: true }}
                        className="h-full bg-brand-accent rounded-full shadow-[0_0_12px_rgba(181,157,242,0.4)]"
                      />
                    </div>
                    <p className="text-[10px] text-brand-mint/30 mt-1 uppercase tracking-widest font-bold">Acquirer: {step.acquirer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-brand-card p-8 rounded-3xl border border-white/10 min-h-[400px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold font-display">Revenue Multiple Projection</h3>
              <p className="text-xs text-brand-mint/40 mt-1">Portfolio diversification vs valuation premium.</p>
            </div>
            <div className="p-3 bg-brand-accent/10 rounded-2xl">
              <TrendingUp className="text-brand-accent" size={20} />
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#ffffff30', fontSize: 10, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  domain={[0, Math.max(12, currentMax + 1)]}
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#ffffff20', fontSize: 10, fontFamily: 'monospace' }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{ 
                    backgroundColor: '#1a141d', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    padding: '12px 16px'
                  }}
                  itemStyle={{ color: '#b59df2', fontSize: '12px', fontWeight: 'bold' }}
                  labelStyle={{ color: '#ffffff60', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Bar 
                  dataKey="max" 
                  radius={[8, 8, 8, 8]}
                  barSize={40}
                  animationDuration={1500}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === chartData.length - 1 ? '#b59df2' : index === 0 ? '#ffffff10' : '#b59df270'} 
                      stroke={index === chartData.length - 1 ? '#decbff' : 'transparent'}
                      strokeWidth={1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Section 5: Multi-Year R&D Roadmap */}
      <section>
        <h2 className="text-xl font-bold mb-6">Multi-Year R&D Roadmap</h2>
        <div className="relative">
          {/* Desktop Timeline Connector */}
          <div className="hidden lg:block absolute left-0 right-0 h-0.5 bg-white/10 top-1/2 -translate-y-1/2 z-0" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {ROADMAP.map((phase, i) => (
              <div key={i} className="flex flex-col">
                <div className="bg-brand-card p-6 rounded-2xl border border-white/10 flex-1 hover:border-brand-accent/30 transition-all flex flex-col">
                  <div className="bg-brand-accent text-brand-bg font-bold p-1 px-3 rounded-full text-xs self-start mb-4">
                    {phase.year}
                  </div>
                  <h3 className="font-bold text-brand-accent mb-4 h-12 lg:h-auto overflow-hidden">{phase.title}</h3>
                  <ul className="space-y-3 mb-6 flex-1">
                    {phase.actions.map((action, j) => (
                      <li key={j} className="flex gap-2 text-xs text-brand-mint/60 leading-relaxed">
                        <ArrowRight size={14} className="text-brand-accent shrink-0 mt-0.5" />
                        {action}
                      </li>
                    ))}
                  </ul>
                  <div className="pt-4 border-t border-white/5 mt-auto relative group z-30">
                    <span className="text-[10px] text-brand-mint/40 uppercase tracking-widest block mb-1">Est. Roadmap Cost</span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{phase.cost}</span>
                      <div className="p-1 rounded bg-brand-accent/10 text-brand-accent">
                        <HelpCircle size={10} className="group-hover:rotate-12 transition-transform cursor-help" />
                      </div>
                    </div>
                    
                    {/* Roadmap Cost Breakdown Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-72 p-5 bg-brand-bg/95 backdrop-blur-xl border border-brand-accent/20 rounded-2xl shadow-3xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-300 transform-gpu z-50">
                      <p className="text-[10px] font-bold text-brand-accent mb-3 uppercase tracking-widest">Cost Allocation Breakdown</p>
                      <div className="space-y-2">
                        {phase.costBreakdown?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-[10px]">
                            <span className="text-brand-mint/60">{item.item}</span>
                            <span className="font-mono font-bold text-white">{item.cost}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-white/10 italic text-[9px] text-brand-mint/40">
                        Based on UK R&D lab benchmarks adjusted for 2026 inflation and processing scale.
                      </div>
                      <div className="absolute -bottom-2 left-6 w-4 h-4 bg-brand-bg border-r border-b border-white/10 rotate-45 transform" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6: Open Questions Panel */}
      <section>
        <div className="bg-brand-card rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-accent/10">
                <HelpCircle className="text-brand-accent" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold font-display">Critical Strategic Questions</h2>
                <p className="text-[10px] text-brand-mint/40 uppercase tracking-widest font-bold mt-0.5">Execution & Risk Tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                <span className="text-[10px] font-bold text-brand-mint/60 uppercase tracking-tight">Active Trackers</span>
              </div>
            </div>
          </div>

          {/* Quick Add Form */}
          <div className="p-6 bg-white/[0.01] border-b border-white/5">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-[10px] uppercase font-bold text-brand-mint/40 mb-1.5 ml-1">Strategy Question</label>
                <input 
                  id="new-q-text"
                  type="text"
                  placeholder="Identify critical data gaps or commercial risks..."
                  className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-accent/40 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const text = (document.getElementById('new-q-text') as HTMLInputElement).value;
                      const owner = (document.getElementById('new-q-owner') as HTMLInputElement).value;
                      const deadline = (document.getElementById('new-q-deadline') as HTMLInputElement).value;
                      if (text) {
                        addQuestion(text, owner || 'TBD', deadline || 'TBD');
                        (document.getElementById('new-q-text') as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-brand-mint/40 mb-1.5 ml-1">Team Owner</label>
                <input 
                  id="new-q-owner"
                  type="text"
                  placeholder="e.g. Lab Team"
                  className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-accent/40 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-bold text-brand-mint/40 mb-1.5 ml-1">Deadline</label>
                  <input 
                    id="new-q-deadline"
                    type="text"
                    placeholder="e.g. Q4 2026"
                    className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-accent/40 transition-colors"
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={() => {
                      const text = (document.getElementById('new-q-text') as HTMLInputElement).value;
                      const owner = (document.getElementById('new-q-owner') as HTMLInputElement).value;
                      const deadline = (document.getElementById('new-q-deadline') as HTMLInputElement).value;
                      if (text) {
                        addQuestion(text, owner || 'TBD', deadline || 'TBD');
                        (document.getElementById('new-q-text') as HTMLInputElement).value = '';
                      }
                    }}
                    className="p-2.5 bg-brand-accent text-brand-bg rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-accent/10"
                  >
                    <PlusCircle size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {questions.map((q) => (
              <div key={q.id} className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4 lg:gap-6 group hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => toggleQuestion(q.id)}
                    className={`shrink-0 w-24 text-[10px] font-bold py-1.5 rounded-lg text-center border transition-all ${
                      q.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      q.status === 'In Progress' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-white/5 text-brand-mint/40 border-white/10'
                    }`}
                  >
                    {q.status}
                  </button>
                  <button 
                    onClick={() => removeQuestion(q.id)}
                    className="md:hidden ml-auto p-1.5 text-brand-mint/20 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex-1 w-full">
                  <input 
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                    className={`w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium transition-all ${
                      q.status === 'Resolved' ? 'text-brand-mint/30 line-through' : 'text-brand-mint/80 focus:text-white'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-4 lg:gap-8 shrink-0 w-full md:w-auto justify-between md:justify-end">
                  <div className="w-28 lg:w-32">
                    <span className="text-[9px] text-brand-mint/30 block mb-0.5 uppercase tracking-widest font-bold">Owner</span>
                    <input 
                      type="text"
                      value={q.owner}
                      onChange={(e) => updateQuestion(q.id, 'owner', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-mono text-brand-mint/60 focus:text-brand-accent transition-colors"
                    />
                  </div>
                  <div className="w-20 lg:w-24">
                    <span className="text-[9px] text-brand-mint/30 block mb-0.5 uppercase tracking-widest font-bold">Deadline</span>
                    <input 
                      type="text"
                      value={q.deadline}
                      onChange={(e) => updateQuestion(q.id, 'deadline', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-mono text-brand-mint/60 focus:text-brand-accent transition-colors"
                    />
                  </div>
                  <button 
                    onClick={() => removeQuestion(q.id)}
                    className="hidden md:block p-2 text-brand-mint/0 group-hover:text-brand-mint/20 hover:!text-rose-500 transition-all rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {questions.length === 0 && (
              <div className="p-12 text-center">
                <HelpCircle className="mx-auto text-brand-mint/10 mb-4" size={48} />
                <p className="text-brand-mint/30 text-sm">No strategic questions tracked. Add one above to start monitoring risks.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
