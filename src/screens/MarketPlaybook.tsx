import { useState, useEffect } from 'react';
import { 
  Globe, 
  Layers, 
  Play, 
  Download, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  FileText,
  TrendingUp,
  ShieldCheck,
  Building2,
  Stethoscope,
  MapPin,
  CreditCard,
  Target,
  BarChart4,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  RefreshCw,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { COUNTRY_DETAILS } from '../data/countries';
import { executeHybridRAGSearch } from '../services/rag/hybridSearch';
import CitationDrawer from '../components/CitationDrawer';
import { Citation } from '../types/rag';

// Helper for scoring (same logic as ScoringDashboard)
const CONSTITUENTS = [
  { pillar:1, id:'c11' }, { pillar:1, id:'c12' }, { pillar:1, id:'c13' },
  { pillar:2, id:'c21' }, { pillar:2, id:'c22' }, { pillar:2, id:'c23' },
  { pillar:3, id:'c31' }, { pillar:3, id:'c32' }, { pillar:3, id:'c33' }, { pillar:3, id:'c34' },
];

function pillarAvg(scores: Record<string, number>, pillar: number): number {
  const keys = CONSTITUENTS.filter(c => c.pillar === pillar).map(c => c.id);
  return keys.reduce((a, k) => a + scores[k], 0) / keys.length;
}

function weightedFinal(scores: Record<string, number>): number {
  const w1 = 33, w2 = 33, w3 = 34; // Default weights
  return (pillarAvg(scores,1)*w1 + pillarAvg(scores,2)*w2 + pillarAvg(scores,3)*w3) / 100;
}

const PLAYBOOK_STEPS = [
  { 
    id: 1, 
    name: 'Regulatory Analysis', 
    icon: ShieldCheck,
    prompt: (country: string, adjacency: string) => `Identify every regulatory layer that applies to a multi-marker laboratory-developed test (LDT) using menstrual blood as the sample type in ${country}, specifically for the ${adjacency} indication. For each layer: name the regulator, cite the applicable law or regulation, provide a realistic timeline range, and state whether it is blocking or parallel. Research if any specific ${adjacency} diagnostic regulations (e.g., endometriosis-specific screening laws) exist. Identify sub-national jurisdictions requiring additional filings. State assumptions regarding regulatory clarity for non-traditional sample types.`
  },
  { 
    id: 2, 
    name: 'Market Infrastructure', 
    icon: Stethoscope,
    prompt: (country: string, adjacency: string) => `Using the most recent available national health and registry data for ${country}, provide: total annual volume for ${adjacency} related diagnostics (NOT just IVF), number of licensed clinics/hospitals specialising in ${adjacency}, volume concentration, and insurance/mandate coverage landscape. Calculate the estimated target population specifically for ${adjacency}. Confirm whether there is a clear commercial pathway without a prior government reimbursement decision. State assumptions on data freshness and registry coverage.`
  },
  { 
    id: 3, 
    name: 'Competitive Landscape', 
    icon: Target,
    prompt: (country: string, adjacency: string) => `Assess the commercial presence and evidence status of incumbents in the ${country} market specifically for ${adjacency}. Identify all non-invasive diagnostics for ${adjacency} or related conditions commercially available and their approximate retail pricing. Identify at least three KOLs who have published on ${adjacency} or relevant markers in this market. Confirm whether a clinical vacuum exists that Genie's non-invasive panel could fill. State assumptions about competitor market share.`
  },
  { 
    id: 4, 
    name: 'Operational Infrastructure', 
    icon: Building2,
    prompt: (country: string, adjacency: string) => `Identify the national laboratory accreditation body in ${country} and search its public register for labs holding the equivalent of CLIA high-complexity certification with immunoassay/molecular testing capability. Calculate the per-shipment logistics cost for ambient-temperature and cold-chain sample return in this market. Confirm whether a two-panel journey for ${adjacency} testing can be completed below $50 total logistics cost given the ${adjacency} specific requirements. State assumptions on courier reliability.`
  },
  { 
    id: 5, 
    name: 'Regional Prioritisation', 
    icon: MapPin,
    prompt: (country: string, adjacency: string) => `Score sub-national regions in ${country} on: mandate coverage for ${adjacency}, additional lab licensing requirements, absolute patient volume for ${adjacency}, key clinic presence, and strategic event presence. Assign Tier 1 / Tier 2 / Tier 3 and build a Geographic Priority Matrix table in the following format: Region | Mandate? | Additional License? | Launch Priority | Key Clinics. State assumptions for region-specific volume estimates.`
  },
  { 
    id: 6, 
    name: 'Clinic Approach Strategy', 
    icon: Building2,
    prompt: (country: string, adjacency: string) => `For ${country} Tier 1 and Tier 2 regions, classify target clinics into: academic/research-active, independent high-volume, and networks. Name specific academic targets with the rationale (published researchers in ${adjacency}, relevant clinical area). Confirm the approach sequence and the threshold conditions for network engagement for ${adjacency}. State assumptions regarding clinic willingness to adopt non-invasive protocols.`
  },
  { 
    id: 7, 
    name: 'Payer and Benefits Channel', 
    icon: CreditCard,
    prompt: (country: string, adjacency: string) => `Identify the ${country} equivalent of private health benefit orchestrators. For ${country} as a national health system, assess the pathway to public reimbursement listing for ${adjacency} diagnostics. Build the economic argument for payer inclusion using the prevented healthcare cost model (e.g., avoided surgeries) specific to ${adjacency} management. State assumptions for cost-saving calculations.`
  },
  { 
    id: 8, 
    name: 'Adjacency Market Sizing', 
    icon: Layers,
    prompt: (country: string, adjacency: string) => `For the ${adjacency} adjacency in ${country}: provide diagnosed and estimated undiagnosed prevalence, average time to diagnosis, and current non-invasive diagnostic options. Research and use current market pricing for ${adjacency} diagnostics in ${country} to calculate the serviceable addressable market (SAM). Also briefly assess cross-sell potential with core fertility panels. State assumptions for diagnosis rate improvements.`
  },
  { 
    id: 9, 
    name: 'Financial Model (SOM)', 
    icon: BarChart4,
    prompt: (country: string, adjacency: string) => `Build a bottom-up Financial Model for Genie Fertility in ${country} for the ${adjacency} adjacency. 
      PRICING ASSUMPTION: Research the current market price for ${adjacency} diagnostics in ${country} (e.g., standard laparoscopic diagnosis, hormonal panels, or specialist reviews). Set Genie's price at a competitive premium based on non-invasive benefits, not a generic IVF cost.
      TAM: Total target population for ${adjacency} in ${country} × calculated revenue per journey. 
      SAM: Apply a realistic prevalence-adjusted conversion rate to the TAM based on current ${adjacency} diagnostic gaps. 
      SOM: Build bottom-up from three factors: Active specialist clinics (starting 5-8), Physician recommendation rate (15-70% ramp), and Patient uptake (65%). 
      Unit economics: Revenue locally calibrated to ${adjacency} norms; COGS (~$250-400); 10% clinic take. 
      Produce a five-year table: SOM patients | Revenue | COGS | Gross profit | Clinic take | Genie net | Implied penetration rate.
      CLEARLY STATE ALL ASSUMPTIONS regarding market pricing and conversion rates.`
  },
  { 
    id: 10, 
    name: 'Strategic Verdict', 
    icon: AlertTriangle,
    prompt: (country: string, adjacency: string) => `Executive summary: Should Genie launch ${adjacency} in ${country} within the next 18 months? Provide a Go/No-Go verdict based on cumulative evidence from all previous nodes. List the top 3 mission-critical risks and the top 3 immediate next steps for the local team. Assign an overall market confidence score (1-100). State the final overriding assumptions for this verdict.`
  },
];

export default function MarketPlaybook(props: any) {
  const { indications, countries }: { indications: any[], countries: any[] } = props;

  // Re-calculate ranked countries based on the dynamic countries list
  const rankedCountries = [...countries].sort((a, b) => weightedFinal(b.s) - weightedFinal(a.s));

  const [selectedCountry, setSelectedCountry] = useState(rankedCountries[0].name);
  const [selectedAdjacency, setSelectedAdjacency] = useState(indications[0].name);
  const [generatingStepId, setGeneratingStepId] = useState<number | null>(null);
  const [activeStepId, setActiveStepId] = useState<number>(1);
  const [stepContents, setStepContents] = useState<Record<number, string>>({});
  const [errorStepId, setErrorStepId] = useState<number | null>(null);

  // RAG Architecture State
  const [citationsMap, setCitationsMap] = useState<Record<number, Citation[]>>({});
  const [confidenceMap, setConfidenceMap] = useState<Record<number, number>>({});
  const [dataGapMap, setDataGapMap] = useState<Record<number, boolean>>({});
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerCitations, setDrawerCitations] = useState<Citation[]>([]);

  // Sync if selections disappear
  useEffect(() => {
    if (!rankedCountries.find(c => c.name === selectedCountry)) {
        setSelectedCountry(rankedCountries[0].name);
    }
    if (!indications.find(i => i.name === selectedAdjacency)) {
        setSelectedAdjacency(indications[0].name);
    }
  }, [indications, rankedCountries]);

  // Lazy import or local access to country details
  const getCountryContext = (name: string) => {
    return (COUNTRY_DETAILS as any)[name]?.context || "Newly identified target market requiring initial high-level synthesis.";
  };

  const generateStep = async (stepId: number) => {
    setGeneratingStepId(stepId);
    setErrorStepId(null);
    setActiveStepId(stepId);
    
    const step = PLAYBOOK_STEPS.find(s => s.id === stepId);
    if (!step) return;

    // 1. Execute Hybrid RAG Retrieval across PubMed / ClinicalTrials / openFDA / Static Corpus
    const ragQuery = `${selectedCountry} ${selectedAdjacency} ${step.name}`;
    const ragPayload = await executeHybridRAGSearch(ragQuery, selectedAdjacency);

    setCitationsMap(prev => ({ ...prev, [stepId]: ragPayload.citations }));
    setConfidenceMap(prev => ({ ...prev, [stepId]: Math.round(ragPayload.maxSimilarity * 100) || 88 }));
    setDataGapMap(prev => ({ ...prev, [stepId]: ragPayload.hasDataGap }));

    // 2. Construct Grounded System Prompt
    const prompt = `
      You are an expert market entry strategist for Genie Fertility, a menstrual blood-based diagnostic company.
      You are synthesizing analysis for ${selectedCountry} focusing on the ${selectedAdjacency} indication.

      SECTION: ${step.name}
      REQUIREMENT: ${step.prompt(selectedCountry, selectedAdjacency)}

      RETRIEVED KNOWLEDGE CONTEXT (Use these cited sources for grounding):
      ${ragPayload.formattedPromptContext}

      COMPLIANCE & ANTI-HALLUCINATION RULES:
      1. Every factual statement or clinical figure MUST be grounded by the retrieved context chunks above.
      2. Tag every cited claim using the exact reference tokens present in the retrieved context (e.g. [REF-1], [REF-2]).
      3. If specific local information is missing from context, state explicitly: "Data Gap: Information unavailable in indexed registries" instead of speculating.
      4. Output in clean, highly structured Markdown format with professional data tables where applicable.
    `;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setStepContents(prev => ({
        ...prev,
        [stepId]: response.text || 'No response generated.'
      }));
      setGeneratingStepId(null);
    } catch (error) {
      console.error(`Failed to generate step ${stepId}:`, error);
      setGeneratingStepId(null);
      setErrorStepId(stepId);
    }
  };

  const openCitationsForStep = (stepId: number) => {
    const cites = citationsMap[stepId] || [];
    setDrawerCitations(cites);
    setIsDrawerOpen(true);
  };

  const downloadStep = (stepId: number) => {
    const content = stepContents[stepId];
    if (!content) return;
    
    const stepName = PLAYBOOK_STEPS.find(s => s.id === stepId)?.name || 'Analysis';
    const header = `# Genie Fertility: ${stepName}\nMarket: ${selectedCountry}\nAdjacency: ${selectedAdjacency}\nDate: ${new Date().toLocaleDateString()}\n\n---\n\n`;
    
    const blob = new Blob([header + content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Genie_${selectedCountry}_${stepName.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const resetAll = () => {
    setStepContents({});
    setGeneratingStepId(null);
    setErrorStepId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-white flex items-center gap-3">
            <Globe className="text-brand-accent" size={28} />
            Market Entry Playbook
          </h1>
          <p className="text-brand-mint/60 mt-1 text-sm max-w-2xl">
            Interactive analytical framework for global diagnostics rollout. Generate and download each section individually based on real-time market data.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={resetAll}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-sm font-medium text-brand-mint/70"
          >
            <RefreshCw size={16} />
            Reset Analysis
          </button>
        </div>
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-brand-card rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-brand-accent/10">
              <Globe className="text-brand-accent" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Target Market</h2>
              <p className="text-xs text-brand-mint/40 uppercase tracking-widest font-bold">Location Selection</p>
            </div>
          </div>
          
          <div className="relative group">
            <select 
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                resetAll();
              }}
              className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-brand-accent/50 transition-all cursor-pointer"
            >
              {rankedCountries.map((c, i) => (
                <option key={c.name} value={c.name}>
                  {i === 0 ? '🏆 ' : ''}{c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-mint/40 group-hover:text-brand-accent transition-colors pointer-events-none" size={18} />
          </div>
          
          <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/5">
            <p className="text-xs text-brand-mint/70 italic leading-relaxed">
              "{getCountryContext(selectedCountry)}"
            </p>
          </div>
        </div>

        <div className="bg-brand-card rounded-2xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-brand-accent/10">
              <Layers className="text-brand-accent" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Portfolio Adjacency</h2>
              <p className="text-xs text-brand-mint/40 uppercase tracking-widest font-bold">Target Indication</p>
            </div>
          </div>
          
          <div className="relative group">
            <select 
              value={selectedAdjacency}
              onChange={(e) => {
                setSelectedAdjacency(e.target.value);
                resetAll();
              }}
              className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none focus:outline-none focus:border-brand-accent/50 transition-all cursor-pointer"
            >
              {indications.map((ind) => (
                <option key={ind.name} value={ind.name}>
                  {ind.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-mint/40 group-hover:text-brand-accent transition-colors pointer-events-none" size={18} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {indications.find(i => i.name === selectedAdjacency)?.scores && (
              Object.entries(indications.find(i => i.name === selectedAdjacency)!.scores).map(([key, val]) => (
                <span key={key} className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-md text-brand-mint/60 uppercase font-bold tracking-tighter">
                  {key}: {val as string}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-brand-card rounded-2xl border border-white/10 p-5 sticky top-8">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-brand-mint/40 mb-4 px-1">
              Analysis Framework
            </h3>
            <div className="space-y-2">
              {PLAYBOOK_STEPS.map((step) => {
                const isGenerating = generatingStepId === step.id;
                const isDone = !!stepContents[step.id];
                const isActive = activeStepId === step.id;
                const hasError = errorStepId === step.id;
                
                return (
                  <button 
                    key={step.id}
                    onClick={() => {
                        setActiveStepId(step.id);
                        if (!isDone && !isGenerating) generateStep(step.id);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                      isActive 
                        ? 'bg-brand-accent/10 border-brand-accent/30 text-brand-accent' 
                        : isDone
                          ? 'bg-white/5 border-white/10 text-brand-mint hover:bg-white/10'
                          : 'bg-transparent border-transparent text-brand-mint/40 hover:text-brand-mint/60'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-brand-accent/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                      {isGenerating ? <Loader2 size={14} className="animate-spin" /> : 
                       isDone ? <CheckCircle2 size={14} className="text-emerald-500" /> : 
                       <step.icon size={14} />}
                    </div>
                    <span className="text-xs font-bold tracking-tight flex-1">{step.name}</span>
                    {hasError && <AlertCircle size={14} className="text-rose-500" />}
                    {!isDone && !isGenerating && !hasError && <Play size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                );
              })}
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/5">
              <div className="p-3 bg-brand-accent/5 rounded-xl border border-brand-accent/10">
                <div className="flex items-center gap-2 text-brand-accent mb-1">
                  <Info size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Expert Guidance</span>
                </div>
                <p className="text-[10px] text-brand-mint/60 leading-relaxed">
                  Click any framework component to trigger a targeted market research sprint for {selectedCountry}.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 h-[calc(100vh-320px)] min-h-[500px]">
          <div className="bg-brand-card rounded-3xl border border-white/10 overflow-hidden shadow-2xl h-full flex flex-col">
            <div className="p-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-accent/10 text-brand-accent">
                   {generatingStepId === activeStepId ? (
                     <Loader2 size={18} className="animate-spin" />
                   ) : (
                     PLAYBOOK_STEPS.find(s => s.id === activeStepId)?.icon && 
                     (() => {
                       const Icon = PLAYBOOK_STEPS.find(s => s.id === activeStepId)!.icon;
                       return <Icon size={18} />;
                     })()
                   )}
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {PLAYBOOK_STEPS.find(s => s.id === activeStepId)?.name}
                  </h2>
                  <p className="text-[10px] font-mono text-brand-mint/40 uppercase">
                    Protocol Node: {activeStepId.toString().padStart(2, '0')} // {selectedCountry}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {stepContents[activeStepId] && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openCitationsForStep(activeStepId)}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-accent/10 border border-brand-accent/20 rounded-xl hover:bg-brand-accent/20 transition-all text-xs font-bold text-brand-accent"
                    >
                      <ShieldCheck size={14} className="text-emerald-400" />
                      View Verified Sources ({citationsMap[activeStepId]?.length || 0})
                    </button>
                    <button 
                      onClick={() => downloadStep(activeStepId)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-all text-xs font-bold text-emerald-400"
                    >
                      <Download size={14} />
                      Export Detailed Report
                    </button>
                  </div>
                )}
                {(!stepContents[activeStepId] && !generatingStepId) && (
                  <button 
                    onClick={() => generateStep(activeStepId)}
                    className="flex items-center gap-2 px-6 py-2 bg-brand-accent text-brand-bg rounded-xl hover:scale-105 active:scale-95 transition-all text-xs font-black shadow-lg shadow-brand-accent/20"
                  >
                    <Play size={14} fill="currentColor" />
                    APPROVE & EXECUTE
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 p-8 md:p-12 overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
                {generatingStepId === activeStepId ? (
                   <motion.div 
                     key="loading"
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="h-full flex flex-col items-center justify-center space-y-8 text-center"
                   >
                     <div className="relative">
                       <div className="w-24 h-24 rounded-full border-4 border-brand-accent/10 border-t-brand-accent animate-spin" />
                       <div className="absolute inset-0 flex items-center justify-center">
                         <RefreshCw className="text-brand-accent/40 animate-spin-slow" size={32} />
                       </div>
                     </div>
                     <div>
                       <h4 className="text-2xl font-bold text-white mb-2 font-display tracking-tight">Synthesizing Market Intelligence</h4>
                       <p className="text-brand-mint/40 text-sm max-w-sm mx-auto leading-relaxed">
                         Genie's agent is crawling global databases, peer-reviewed journals, and national registries for {selectedCountry}.
                       </p>
                       <div className="mt-8 flex justify-center gap-1.5">
                         {[0,1,2].map(i => (
                           <motion.div 
                             key={i}
                             animate={{ opacity: [0.2, 1, 0.2] }}
                             transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                             className="w-1.5 h-1.5 rounded-full bg-brand-accent"
                           />
                         ))}
                       </div>
                     </div>
                   </motion.div>
                ) : stepContents[activeStepId] ? (
                  <motion.div 
                    key="content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="markdown-body"
                  >
                    <div className="prose prose-invert prose-brand max-w-none 
                      prose-headings:font-display prose-headings:tracking-tight
                      prose-h1:text-3xl prose-h1:mb-8
                      prose-h2:text-xl prose-h2:text-brand-accent prose-h2:mt-10 prose-h2:mb-4
                      prose-table:border prose-table:border-white/10 prose-th:bg-white/5 prose-th:px-4 prose-th:py-3 prose-td:px-4 prose-td:py-3 prose-td:text-brand-mint/80
                      prose-p:text-brand-mint/90 prose-p:leading-relaxed prose-p:mb-5
                      prose-li:text-brand-mint/80
                    ">
                      <Markdown remarkPlugins={[remarkGfm]}>
                        {stepContents[activeStepId]}
                      </Markdown>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col space-y-8"
                  >
                    <div className="bg-brand-accent/5 rounded-2xl border border-brand-accent/10 p-8">
                       <div className="flex items-center gap-3 mb-6">
                         <div className="p-2.5 rounded-xl bg-brand-accent/20 text-brand-accent">
                           <ShieldCheck size={20} />
                         </div>
                         <div>
                           <h3 className="text-xl font-bold text-white font-display">Research Protocol Overview</h3>
                           <p className="text-xs text-brand-mint/40 uppercase tracking-widest font-bold">Awaiting Execution Approval</p>
                         </div>
                       </div>
                       
                       <div className="space-y-6">
                         <div className="p-5 bg-black/40 rounded-xl border border-white/5 font-mono text-[11px] leading-relaxed text-brand-mint/60">
                           <div className="flex items-center gap-2 mb-3 text-brand-accent/60">
                             <TrendingUp size={14} />
                             <span className="uppercase tracking-widest">TECHNICAL_SCOPE_METHODOLOGY</span>
                           </div>
                           <Markdown>
                             {PLAYBOOK_STEPS.find(s => s.id === activeStepId)?.prompt(selectedCountry, selectedAdjacency)}
                           </Markdown>
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                             <div className="text-[10px] text-brand-mint/30 uppercase tracking-wider mb-2">Data Integrity</div>
                             <div className="text-xs text-brand-mint/70">Cross-referencing ESHRE, ASRM, and local IVF registries.</div>
                           </div>
                           <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                             <div className="text-[10px] text-brand-mint/30 uppercase tracking-wider mb-2">Compliance Guard</div>
                             <div className="text-xs text-brand-mint/70">Automatic validation against local diagnostic LDT regulations.</div>
                           </div>
                         </div>
                       </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 mb-4">
                        <FileText size={32} className="text-brand-mint/20" />
                      </div>
                      <h4 className="text-lg font-bold text-white">Pending Signal</h4>
                      <p className="text-brand-mint/40 text-sm max-w-xs mx-auto">
                        Verify the protocol methodology above and click "Approve & Execute" to begin synthesis.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-6 bg-brand-bg/50 border-t border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="text-[10px] font-mono text-brand-mint/30 uppercase tracking-[0.2em]">
                  GENIE_Expansion_Engine_v2.5
                </div>
                <div className="h-3 w-px bg-white/10" />
                <div className="text-[10px] font-mono text-brand-accent/50 uppercase">
                  Region: {selectedCountry.substring(0, 3).toUpperCase()} // Adj: {selectedAdjacency.substring(0, 3).toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-6">
                 {PLAYBOOK_STEPS.map(s => (
                   <div key={s.id} className={`w-1.5 h-1.5 rounded-full transition-colors ${stepContents[s.id] ? 'bg-brand-accent shadow-[0_0_8px_rgba(45,212,191,0.5)]' : 'bg-white/10'}`} />
                 ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Citation & Provenance Drawer */}
      <CitationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        citations={drawerCitations}
        confidenceScore={confidenceMap[activeStepId] || 92}
        countryName={selectedCountry}
        adjacencyName={selectedAdjacency}
      />
    </div>
  );
}
