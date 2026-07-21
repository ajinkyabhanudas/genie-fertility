/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Layers, 
  Users, 
  AlertTriangle, 
  ChevronRight,
  Menu,
  X,
  BarChart3,
  Zap,
  Globe
} from 'lucide-react';
import PortfolioTracker from './screens/PortfolioTracker';
import ScoringDashboard from './screens/ScoringDashboard';
import MarketPlaybook from './screens/MarketPlaybook';
import { INDICATIONS as INITIAL_INDICATIONS } from './data/indications';
import { ORIG_DATA as INITIAL_COUNTRIES } from './data/countries';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('scoring');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Shared state
  const [indications, setIndications] = useState<any[]>(INITIAL_INDICATIONS);
  const [countries, setCountries] = useState(() => INITIAL_COUNTRIES.map(c => ({ name: c.name, s: { ...c.s } })));

  const SCREENS = [
    { 
      id: 'scoring', 
      name: 'Scoring Dashboard', 
      icon: BarChart3, 
      component: () => <ScoringDashboard data={countries} setData={setCountries} /> 
    },
    { 
      id: 'portfolio', 
      name: 'Portfolio Optimisation Analysis', 
      icon: Layers, 
      component: () => <PortfolioTracker indications={indications} setIndications={setIndications} /> 
    },
    { 
      id: 'playbook', 
      name: 'Market Playbook', 
      icon: Globe, 
      component: () => <MarketPlaybook indications={indications} countries={countries} /> 
    },
  ];

  const ActiveComponent = SCREENS.find(s => s.id === activeScreen)?.component || SCREENS[0].component;

  return (
    <div className="flex h-screen bg-brand-bg text-white overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-brand-card border-r border-white/10 transition-all duration-300 flex flex-col z-50`}
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && (
            <div className="flex flex-col">
              <span className="text-brand-accent font-display text-xl font-bold tracking-tight">GENIE</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-brand-mint/60 -mt-1">Fertility</span>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-white/5 rounded-md transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {SCREENS.map((screen) => (
            <button
              key={screen.id}
              onClick={() => setActiveScreen(screen.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-all group ${
                activeScreen === screen.id 
                  ? 'bg-brand-accent text-brand-bg font-semibold shadow-lg shadow-brand-accent/20' 
                  : 'text-brand-mint/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <screen.icon size={20} className={activeScreen === screen.id ? '' : 'group-hover:scale-110 transition-transform'} />
              {isSidebarOpen && <span className="ml-3 text-sm text-left leading-tight block flex-1">{screen.name}</span>}
              {isSidebarOpen && activeScreen === screen.id && <ChevronRight size={14} className="ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/10">
          <div className={`flex items-center ${isSidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-brand-accent/20 flex items-center justify-center text-brand-accent font-bold text-xs">
              <Zap size={14} />
            </div>
            {isSidebarOpen && (
              <div className="ml-3 overflow-hidden">
                <p className="text-xs font-bold text-white tracking-tight">Genie Platform</p>
                <p className="text-[10px] text-brand-mint/40 truncate uppercase tracking-widest font-bold">Internal Protocol</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-7xl mx-auto p-8">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}
