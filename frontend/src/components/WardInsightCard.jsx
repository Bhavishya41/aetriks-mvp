import { useEffect, useState } from 'react';

function MiniGauge({ label, value, unit, color, icon, min = 0, max = 100, warnThreshold, dangerThreshold }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(value), 100);
    return () => clearTimeout(timeout);
  }, [value]);

  const pct = Math.min(100, Math.max(0, ((animated - min) / (max - min)) * 100));
  const isDanger = value >= dangerThreshold;
  const isWarn = value >= warnThreshold;

  const barColor = isDanger ? '#ef4444' : isWarn ? '#f59e0b' : color;
  const status = isDanger ? 'danger' : isWarn ? 'warn' : 'ok';

  return (
    <div className="flex flex-col gap-1.5" id={`gauge-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{icon}</span>
          <span className="text-[11px] font-medium text-slate-400">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-bold" style={{ color: barColor }}>
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
          <span className="text-[10px] text-slate-500">{unit}</span>
          {status === 'danger' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              HIGH
            </span>
          )}
          {status === 'warn' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
              WARN
            </span>
          )}
        </div>
      </div>
      <div className="gauge-track h-2 w-full">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${barColor})`,
            transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: `0 0 8px ${barColor}60`,
          }}
        />
      </div>
    </div>
  );
}

function RiskBadge({ risk }) {
  const getRiskInfo = (r) => {
    if (r < 0.25) return { label: 'Healthy', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)' };
    if (r < 0.5) return { label: 'Moderate', color: '#eab308', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.3)' };
    if (r < 0.7) return { label: 'Elevated', color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)' };
    if (r < 0.85) return { label: 'High Risk', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' };
    return { label: 'CRITICAL', color: '#fff', bg: 'rgba(127,29,29,0.6)', border: 'rgba(239,68,68,0.8)' };
  };

  const info = getRiskInfo(risk);
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
      style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}` }}>
      {info.label}
    </span>
  );
}

// Generate stressor data from risk score
function getStressors(ward) {
  const r = ward.risk;
  return {
    no2: Math.round(20 + r * 80),         // µg/m³, 20–100
    surfaceTemp: +(25 + r * 18).toFixed(1), // °C, 25–43
    ndvi: +((1 - r) * 0.65 + 0.05).toFixed(2), // 0.05–0.70
  };
}

function getNarrative(ward, stressors) {
  const { no2, surfaceTemp, ndvi } = stressors;
  const r = ward.risk;

  if (r >= 0.85) {
    return `${ward.name} is in a critical environmental emergency. NO₂ levels (${no2} µg/m³) are 3× safe limits, while barren surfaces push local temperatures to ${surfaceTemp}°C — a brutal ${Math.round((surfaceTemp - 30))}°C heat island spike. Negligible vegetation (NDVI ${ndvi}) means no natural cooling buffer. Residents face compounded respiratory and heat-stress risks. Immediate intervention required.`;
  }
  if (r >= 0.7) {
    return `High pollution and low greenery are forming a dangerous feedback loop in ${ward.name}. NO₂ at ${no2} µg/m³ significantly strains respiratory health, while insufficient vegetation (NDVI ${ndvi}) drives a +${Math.round(surfaceTemp - 30)}°C heat island. Long-term exposure is linked to elevated rates of asthma and cardiovascular disease.`;
  }
  if (r >= 0.5) {
    return `${ward.name} shows moderate environmental stress. Elevated NO₂ (${no2} µg/m³) alongside reduced vegetation (NDVI ${ndvi}) is contributing to mild surface warming of ${surfaceTemp}°C. Without intervention, conditions may deteriorate — particularly for elderly and vulnerable populations.`;
  }
  if (r >= 0.25) {
    return `Environmental indicators for ${ward.name} are within acceptable ranges. NO₂ at ${no2} µg/m³ and NDVI of ${ndvi} suggest a largely stable ecosystem. Surface temperature of ${surfaceTemp}°C is normal. Routine monitoring recommended to maintain healthy status.`;
  }
  return `${ward.name} demonstrates excellent environmental health. Strong vegetation cover (NDVI ${ndvi}) actively cools the area, keeping surface temps at ${surfaceTemp}°C and air quality pristine (NO₂ ${no2} µg/m³). A model ward for green urban planning.`;
}

export default function WardInsightCard({ ward, onClose }) {
  const stressors = getStressors(ward);
  const narrative = getNarrative(ward, stressors);

  return (
    <div
      id="ward-insight-card"
      className="slide-up glass-card rounded-2xl overflow-hidden"
      style={{
        width: 340,
        maxWidth: 'calc(100vw - 2rem)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div className="relative px-5 pt-5 pb-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Background risk glow */}
        <div className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(ellipse at top right, ${ward.risk > 0.7 ? '#ef4444' : ward.risk > 0.45 ? '#f97316' : '#22c55e'} 0%, transparent 70%)`,
          }}
        />

        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <RiskBadge risk={ward.risk} />
              <span className="text-[10px] text-slate-500 font-mono">{ward.id}</span>
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{ward.name}</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="text-xs text-slate-400">
                <span className="text-white font-semibold">{(ward.population / 1000).toFixed(0)}k</span> at risk
              </span>
            </div>
          </div>

          <button
            id="close-insight-card"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Risk score bar */}
        <div className="relative mt-3">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Risk Index</span>
            <span className="font-bold text-white">{Math.round(ward.risk * 100)}<span className="text-slate-500">/100</span></span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${ward.risk * 100}%`,
                background: ward.risk > 0.85 ? 'linear-gradient(90deg, #f97316, #ef4444, #991b1b)' :
                  ward.risk > 0.5 ? 'linear-gradient(90deg, #eab308, #f97316)' :
                    'linear-gradient(90deg, #22c55e, #eab308)',
                transition: 'width 1s ease',
                boxShadow: `0 0 10px ${ward.risk > 0.7 ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Environmental Stressors */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Environmental Stressors
        </p>
        <div className="space-y-3">
          <MiniGauge
            label="Air Quality (NO₂)"
            value={stressors.no2}
            unit="µg/m³"
            icon="💨"
            color="#3b82f6"
            min={10}
            max={120}
            warnThreshold={50}
            dangerThreshold={80}
          />
          <MiniGauge
            label="Surface Temp."
            value={stressors.surfaceTemp}
            unit="°C"
            icon="🌡️"
            color="#f97316"
            min={22}
            max={46}
            warnThreshold={35}
            dangerThreshold={40}
          />
          <MiniGauge
            label="Vegetation (NDVI)"
            value={Math.round(stressors.ndvi * 100)}
            unit="%"
            icon="🌿"
            color="#22c55e"
            min={0}
            max={100}
            warnThreshold={70}
            dangerThreshold={90}
          />
        </div>
      </div>

      {/* Health Narrative */}
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-md flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" className="w-2.5 h-2.5">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
          <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">The Story</p>
        </div>
        <p className="text-[12px] text-slate-300 leading-relaxed">
          {narrative}
        </p>
      </div>

      {/* Action Button */}
      <div className="px-5 py-4">
        <button
          id="generate-ward-action-plan"
          className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 group relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #fbbf24 100%)',
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            color: '#0a0e1a',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 6px 30px rgba(245, 158, 11, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(245, 158, 11, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 shimmer opacity-50" />

          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 relative z-10">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="relative z-10">Generate Ward Action Plan</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 relative z-10 group-hover:translate-x-0.5 transition-transform">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <p className="text-center text-[10px] text-slate-600 mt-2">
          Powered by Sentinel-2 · Updated 4min ago
        </p>
      </div>
    </div>
  );
}
