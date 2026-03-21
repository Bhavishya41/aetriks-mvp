import { useState } from 'react';

const navItems = [
  {
    id: 'city-overview',
    label: 'City Overview',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    badge: null,
  },
  {
    id: 'health-risk-map',
    label: 'Health Risk Map',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    ),
    badge: '3 Critical',
  },
  {
    id: 'ward-analysis',
    label: 'Ward Analysis',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    badge: null,
  },
  {
    id: 'generate-report',
    label: 'Official Report',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    badge: null,
  },
];

const statCards = [
  { label: 'Wards Monitored', value: '42', color: '#3b82f6' },
  { label: 'Critical Alerts', value: '7', color: '#f59e0b' },
  { label: 'At-Risk Pop.', value: '2.4M', color: '#ef4444' },
];

export default function Sidebar({ activeNav, setActiveNav }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sidebar-glow glass relative flex flex-col transition-all duration-500 ${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 z-20`}
      style={{ background: 'linear-gradient(180deg, #0c1221 0%, #0a0e1a 100%)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1d40af 0%, #3b82f6 100%)' }}>
            {/* Satellite icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" className="w-5 h-5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="pulse-dot absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0c1221]" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white leading-tight">Health Sentinel</p>
            <p className="text-[10px] text-blue-400/80 font-medium tracking-wider uppercase">Satellite Analytics</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`ml-auto p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all ${collapsed ? 'mx-auto' : ''}`}
          aria-label="Toggle sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            {collapsed
              ? <path d="M9 18l6-6-6-6" />
              : <path d="M15 18l-6-6 6-6" />
            }
          </svg>
        </button>
      </div>

      {/* Live indicator */}
      {!collapsed && (
        <div className="mx-4 mt-4 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[11px] text-green-400 font-semibold tracking-wide">LIVE · Sentinel-2 Feed</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        <p className={`text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2 px-2 ${collapsed ? 'hidden' : ''}`}>
          Navigation
        </p>
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-left ${
                isActive
                  ? 'nav-item-active text-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className={`flex-shrink-0 transition-transform duration-200 ${isActive ? 'text-blue-400' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mini stats */}
      {!collapsed && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-3">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-1 mb-2">
            Live Stats
          </p>
          {statCards.map((s) => (
            <div key={s.label} className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[11px] text-slate-400">{s.label}</span>
              <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* User / Footer */}
      <div className={`border-t border-white/5 p-3 flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #1e3a5f, #3b82f6)' }}>
          <span className="text-xs font-bold text-white">MC</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">Admin · BBMP</p>
            <p className="text-[10px] text-slate-500 truncate">Municipal Corporation</p>
          </div>
        )}
      </div>
    </aside>
  );
}
