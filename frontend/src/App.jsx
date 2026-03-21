import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import MapCanvas from './components/MapCanvas';
import SatelliteMap from './components/SatelliteMap';
import WardInsightCard from './components/WardInsightCard';
import AnalyticsDrawer from './components/AnalyticsDrawer';

function CityOverviewPanel() {
  const stats = [
    { label: 'Total Wards', value: '42', sub: 'Monitored', icon: '🏙️', color: '#3b82f6' },
    { label: 'Healthy Wards', value: '18', sub: 'Risk < 25%', icon: '🌿', color: '#22c55e' },
    { label: 'At-Risk Wards', value: '17', sub: 'Risk 25–70%', icon: '⚠️', color: '#f59e0b' },
    { label: 'Critical Wards', value: '7', sub: 'Risk > 70%', icon: '🔴', color: '#ef4444' },
    { label: 'Population Scanned', value: '11.4M', sub: 'Today', icon: '👥', color: '#a78bfa' },
    { label: 'Avg. NO₂', value: '54 µg/m³', sub: 'City-wide', icon: '💨', color: '#60a5fa' },
    { label: 'Avg. NDVI', value: '0.28', sub: 'Low greenery', icon: '🌱', color: '#86efac' },
    { label: 'Avg. Surface Temp', value: '36.4°C', sub: '+4.2°C vs 2020', icon: '🌡️', color: '#fb923c' },
  ];

  return (
    <div className="absolute inset-0 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Bengaluru Health Overview</h2>
          <p className="text-sm text-slate-400">Real-time satellite monitoring · March 2026</p>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="glass-card rounded-xl p-4 hover:border-white/20 transition-all">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs font-semibold text-white">{s.label}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* City health score */}
        <div className="glass-card rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-white">City Health Score</h3>
              <p className="text-xs text-slate-400 mt-0.5">Composite Environmental Health Index</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black" style={{ color: '#f59e0b' }}>46</div>
              <div className="text-xs text-amber-400 font-semibold">/ 100 · Moderate</div>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full risk-gradient-bar rounded-full"
              style={{ width: '46%', transition: 'width 1s ease' }} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>0 — Critical</span><span>50 — Fair</span><span>100 — Excellent</span>
          </div>
        </div>

        {/* Alert feed */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            Active Alerts
          </h3>
          {[
            { ward: 'Bommanahalli', alert: 'Critical NO₂ + Heat Island', severity: 'CRITICAL', time: '2m ago' },
            { ward: 'Bellandur', alert: 'Persistent Heat Island (>40°C)', severity: 'HIGH', time: '11m ago' },
            { ward: 'Electronic City', alert: 'Vegetation Loss >30% in 6mo', severity: 'HIGH', time: '28m ago' },
            { ward: 'HSR Layout', alert: 'NO₂ exceeds WHO limit', severity: 'ELEVATED', time: '1h ago' },
          ].map((a) => (
            <div key={a.ward} className="flex items-center gap-3 py-2.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                a.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                a.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>{a.severity}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-white">{a.ward}</span>
                <span className="text-xs text-slate-400 ml-2">{a.alert}</span>
              </div>
              <span className="text-[10px] text-slate-600 flex-shrink-0">{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WardAnalysisPanel() {
  const wards = [
    { id: 'W08', name: 'Bommanahalli', risk: 0.95, pop: 278000, no2: 98, temp: 42.1, ndvi: 0.08 },
    { id: 'W18', name: 'Bellandur', risk: 0.91, pop: 268000, no2: 91, temp: 41.3, ndvi: 0.09 },
    { id: 'W15', name: 'Electronic City', risk: 0.82, pop: 387000, no2: 86, temp: 39.7, ndvi: 0.12 },
    { id: 'W05', name: 'HSR Layout', risk: 0.88, pop: 215000, no2: 89, temp: 40.6, ndvi: 0.1 },
    { id: 'W01', name: 'Koramangala', risk: 0.78, pop: 182000, no2: 78, temp: 38.4, ndvi: 0.17 },
  ];

  return (
    <div className="absolute inset-0 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">Ward-Level Analysis</h2>
          <p className="text-sm text-slate-400">Ranked by environmental risk index · All 42 wards</p>
        </div>
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Ward', 'Risk Score', 'Population', 'NO₂', 'Temp', 'NDVI', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wards.map((w, i) => (
                <tr key={w.id}
                  className="hover:bg-white/3 transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 text-xs font-mono">#{i + 1}</span>
                      <div>
                        <div className="text-xs font-semibold text-white">{w.name}</div>
                        <div className="text-[10px] text-slate-600">{w.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${w.risk * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-red-400">{Math.round(w.risk * 100)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{(w.pop / 1000).toFixed(0)}k</td>
                  <td className="px-4 py-3 text-xs font-semibold text-red-400">{w.no2} <span className="text-slate-600 font-normal">µg/m³</span></td>
                  <td className="px-4 py-3 text-xs font-semibold text-orange-400">{w.temp}°C</td>
                  <td className="px-4 py-3 text-xs font-semibold text-green-400">{w.ndvi}</td>
                  <td className="px-4 py-3">
                    <button className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                      Action Plan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportPanel() {
  return (
    <div className="absolute inset-0 overflow-y-auto p-6 flex items-center justify-center">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', boxShadow: '0 8px 30px rgba(59,130,246,0.3)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" className="w-10 h-10">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Official Report Generator</h2>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Generate comprehensive environmental health reports for the municipal corporation, ready for official use and policy action.
        </p>
        <button
          id="generate-official-report"
          className="w-full py-4 rounded-xl font-bold text-sm transition-all hover:scale-105 amber-glow"
          style={{
            background: 'linear-gradient(135deg, #92400e, #f59e0b)',
            color: '#0a0e1a',
            boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
          }}
        >
          🏛️ Generate Official Ward Report
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState('health-risk-map');
  const [selectedWard, setSelectedWard] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const isMapView = activeNav === 'health-risk-map';

  return (
    <div className="flex h-screen w-screen overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif", background: '#0a0e1a' }}>

      {/* Sidebar */}
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <TopBar activeNav={activeNav} />

        {/* Content: Map or Panel */}
        <div className="flex-1 relative overflow-hidden">

          {/* Map view */}
          {isMapView && (
            <div className="absolute inset-0 flex flex-col">
              {/* Map canvas fills remaining space above drawer */}
              <div className="flex-1 relative min-h-0">
                <SatelliteMap
                  onWardSelect={(ward) => {
                    setSelectedWard(ward);
                    setDrawerOpen(true);
                  }}
                  selectedWard={selectedWard}
                />

                {/* Floating insight card */}
                {selectedWard && (
                  <div
                    className="absolute left-4 top-16 z-20 fade-in"
                    style={{ maxHeight: 'calc(100% - 80px)', overflowY: 'auto' }}
                  >
                    <WardInsightCard
                      ward={selectedWard}
                      onClose={() => setSelectedWard(null)}
                    />
                  </div>
                )}
              </div>

              {/* Analytics Drawer */}
              <AnalyticsDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen(o => !o)}
                ward={selectedWard}
              />
            </div>
          )}

          {/* Other views */}
          {activeNav === 'city-overview' && (
            <div className="absolute inset-0 fade-in">
              <CityOverviewPanel />
            </div>
          )}

          {activeNav === 'ward-analysis' && (
            <div className="absolute inset-0 fade-in">
              <WardAnalysisPanel />
            </div>
          )}

          {activeNav === 'generate-report' && (
            <div className="absolute inset-0 fade-in">
              <ReportPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
