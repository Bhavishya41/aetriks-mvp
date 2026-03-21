const alerts = [
  { ward: 'Bommanahalli', type: 'Critical NO₂', time: '2m ago', color: '#ef4444' },
  { ward: 'Bellandur', type: 'Heat Island Alert', time: '11m ago', color: '#f59e0b' },
  { ward: 'Electronic City', type: 'Low NDVI Warning', time: '28m ago', color: '#f97316' },
];

export default function TopBar({ activeNav }) {
  const titles = {
    'city-overview': 'City Overview',
    'health-risk-map': 'Health Risk Map',
    'ward-analysis': 'Ward Analysis',
    'generate-report': 'Official Report Generator',
  };

  return (
    <header
      id="main-topbar"
      className="flex items-center justify-between px-5 h-14 flex-shrink-0 z-10"
      style={{
        background: 'rgba(10, 14, 26, 0.9)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Page title */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-white">{titles[activeNav]}</h1>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
          <span>/</span>
          <span>Bengaluru Metropolitan</span>
        </div>
      </div>

      {/* Center: Quick alerts ticker */}
      <div className="hidden md:flex items-center gap-2 overflow-hidden max-w-xs">
        {alerts.map((a, i) => (
          <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium flex-shrink-0 transition-all hover:opacity-90`}
            style={{ background: `${a.color}15`, border: `1px solid ${a.color}30`, color: a.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.color }} />
            <span>{a.ward}</span>
            <span className="text-[9px] opacity-60">· {a.time}</span>
          </div>
        ))}
      </div>

      {/* Right: Time + refresh */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span id="topbar-time" className="text-xs font-semibold text-white tabular-nums">
            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-[10px] text-slate-500">
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <button
          id="refresh-data-btn"
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all"
          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <button
          id="report-btn"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
            boxShadow: '0 2px 12px rgba(59, 130, 246, 0.4)',
            color: 'white',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="hidden sm:inline">Export Report</span>
        </button>
      </div>
    </header>
  );
}
