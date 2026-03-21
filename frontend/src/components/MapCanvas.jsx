import { useEffect, useRef, useState } from 'react';

// Mock ward data with SVG polygon positions for the placeholder map
const wards = [
  { id: 'W01', name: 'Koramangala', risk: 0.78, population: 182000, cx: 58, cy: 44, rx: 14, ry: 10 },
  { id: 'W02', name: 'Indiranagar', risk: 0.55, population: 145000, cx: 74, cy: 30, rx: 10, ry: 8 },
  { id: 'W03', name: 'Whitefield', risk: 0.42, population: 320000, cx: 85, cy: 45, rx: 13, ry: 9 },
  { id: 'W04', name: 'Hebbal', risk: 0.19, population: 98000, cx: 62, cy: 18, rx: 10, ry: 7 },
  { id: 'W05', name: 'HSR Layout', risk: 0.88, population: 215000, cx: 55, cy: 60, rx: 12, ry: 9 },
  { id: 'W06', name: 'Rajajinagar', risk: 0.31, population: 167000, cx: 36, cy: 32, rx: 11, ry: 8 },
  { id: 'W07', name: 'Yelahanka', risk: 0.24, population: 89000, cx: 48, cy: 12, rx: 9, ry: 7 },
  { id: 'W08', name: 'Bommanahalli', risk: 0.95, population: 278000, cx: 66, cy: 70, rx: 13, ry: 10 },
  { id: 'W09', name: 'Majestic', risk: 0.61, population: 124000, cx: 42, cy: 44, rx: 10, ry: 8 },
  { id: 'W10', name: 'BTM Layout', risk: 0.74, population: 198000, cx: 48, cy: 58, rx: 11, ry: 8 },
  { id: 'W11', name: 'Malleshwaram', risk: 0.38, population: 112000, cx: 40, cy: 26, rx: 10, ry: 7 },
  { id: 'W12', name: 'Jayanagar', risk: 0.52, population: 143000, cx: 44, cy: 54, rx: 9, ry: 8 },
  { id: 'W13', name: 'JP Nagar', risk: 0.66, population: 231000, cx: 38, cy: 64, rx: 12, ry: 9 },
  { id: 'W14', name: 'Banashankari', risk: 0.44, population: 176000, cx: 30, cy: 56, rx: 11, ry: 8 },
  { id: 'W15', name: 'Electronic City', risk: 0.82, population: 387000, cx: 62, cy: 82, rx: 14, ry: 10 },
  { id: 'W16', name: 'Yeshwanthpur', risk: 0.29, population: 104000, cx: 28, cy: 40, rx: 9, ry: 7 },
  { id: 'W17', name: 'KR Puram', risk: 0.71, population: 195000, cx: 78, cy: 55, rx: 11, ry: 9 },
  { id: 'W18', name: 'Bellandur', risk: 0.91, population: 268000, cx: 76, cy: 68, rx: 12, ry: 9 },
];

function getRiskColor(risk, alpha = 1) {
  if (risk < 0.25) return `rgba(34, 197, 94, ${alpha})`;
  if (risk < 0.5) return `rgba(234, 179, 8, ${alpha})`;
  if (risk < 0.7) return `rgba(249, 115, 22, ${alpha})`;
  if (risk < 0.85) return `rgba(239, 68, 68, ${alpha})`;
  return `rgba(127, 29, 29, ${alpha})`;
}

function getRiskLabel(risk) {
  if (risk < 0.25) return { label: 'Healthy', color: '#22c55e' };
  if (risk < 0.5) return { label: 'Moderate', color: '#eab308' };
  if (risk < 0.7) return { label: 'Elevated', color: '#f97316' };
  if (risk < 0.85) return { label: 'High Risk', color: '#ef4444' };
  return { label: 'Critical', color: '#991b1b' };
}

// Animated grid lines for the map background
function MapGrid() {
  return (
    <g opacity="0.08">
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={`v${i}`} x1={`${(i + 1) * 8.33}%`} y1="0" x2={`${(i + 1) * 8.33}%`} y2="100%"
          stroke="#3b82f6" strokeWidth="0.5" />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={`${(i + 1) * 8.33}%`} x2="100%" y2={`${(i + 1) * 8.33}%`}
          stroke="#3b82f6" strokeWidth="0.5" />
      ))}
    </g>
  );
}

export default function MapCanvas({ onWardClick, selectedWard }) {
  const [hoveredWard, setHoveredWard] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  const handleMouseMove = (e, ward) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, ward });
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden" id="map-canvas">
      {/* Satellite-style dark background with subtle terrain texture */}
      <div className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 40%, #0d1b2e 0%, #060b14 60%, #020507 100%)',
        }}
      />

      {/* Subtle satellite grid overlay */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'80\' height=\'80\' viewBox=\'0 0 80 80\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%234b6cb7\' fill-opacity=\'1\'%3E%3Cpath d=\'M0 0h1v80H0zm80 0v1H0V0zm0 80v-1H0v1zm-80 0h1V0H0z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
      />

      {/* Terrain blobs */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <radialGradient id="terrainGrad1" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#0f2240" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#060b14" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="terrainGrad2" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#0a1a30" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#060b14" stopOpacity="0" />
          </radialGradient>
          <filter id="wardBlur">
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
        </defs>
        <ellipse cx="50" cy="50" rx="40" ry="35" fill="url(#terrainGrad1)" />
        <ellipse cx="70" cy="30" rx="25" ry="20" fill="url(#terrainGrad2)" />
        <MapGrid />
      </svg>

      {/* Main SVG choropleth map */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        style={{ padding: '5%' }}
      >
        <defs>
          <filter id="glowFilter">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="criticalGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {wards.map((ward) => {
          const isSelected = selectedWard?.id === ward.id;
          const isHovered = hoveredWard === ward.id;
          const color = getRiskColor(ward.risk, 0.75);
          const strokeColor = getRiskColor(ward.risk, 1);
          const isCritical = ward.risk >= 0.85;

          return (
            <g key={ward.id}>
              {/* Glow ring for critical wards */}
              {isCritical && (
                <ellipse
                  cx={ward.cx}
                  cy={ward.cy}
                  rx={ward.rx + 3}
                  ry={ward.ry + 3}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="0.8"
                  opacity="0.3"
                  filter="url(#criticalGlow)"
                  style={{ animation: `wardPulse 2s ease-in-out infinite` }}
                />
              )}

              {/* Ward ellipse */}
              <ellipse
                cx={ward.cx}
                cy={ward.cy}
                rx={isSelected || isHovered ? ward.rx + 1.5 : ward.rx}
                ry={isSelected || isHovered ? ward.ry + 1.5 : ward.ry}
                fill={color}
                stroke={isSelected ? '#60a5fa' : strokeColor}
                strokeWidth={isSelected ? 0.8 : 0.4}
                filter={isCritical ? 'url(#criticalGlow)' : isSelected ? 'url(#glowFilter)' : undefined}
                className="map-ward-hover"
                onClick={() => onWardClick(ward)}
                onMouseEnter={() => setHoveredWard(ward.id)}
                onMouseLeave={() => { setHoveredWard(null); setTooltip(null); }}
                onMouseMove={(e) => handleMouseMove(e, ward)}
                style={{
                  transition: 'all 0.2s ease',
                  opacity: selectedWard && !isSelected ? 0.6 : 1,
                }}
              />

              {/* Ward label */}
              {(isHovered || isSelected) && (
                <text
                  x={ward.cx}
                  y={ward.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="2.2"
                  fontWeight="600"
                  fill="white"
                  style={{ pointerEvents: 'none', fontFamily: 'Inter, sans-serif' }}
                >
                  {ward.name.split(' ')[0]}
                </text>
              )}

              {/* Critical warning dot */}
              {isCritical && !isSelected && (
                <circle
                  cx={ward.cx + ward.rx - 2}
                  cy={ward.cy - ward.ry + 1}
                  r="1.2"
                  fill="#f59e0b"
                  style={{ animation: 'pulseDot 1.5s ease-in-out infinite' }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Map tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-30 px-3 py-2 rounded-lg text-xs font-medium"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            background: 'rgba(10, 14, 26, 0.95)',
            border: `1px solid ${getRiskColor(tooltip.ward.risk, 0.6)}`,
            boxShadow: `0 4px 15px rgba(0,0,0,0.5), 0 0 10px ${getRiskColor(tooltip.ward.risk, 0.3)}`,
          }}
        >
          <div className="text-white font-semibold">{tooltip.ward.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full" style={{ background: getRiskColor(tooltip.ward.risk) }} />
            <span style={{ color: getRiskColor(tooltip.ward.risk) }}>{getRiskLabel(tooltip.ward.risk).label}</span>
            <span className="text-slate-400 ml-1">{Math.round(tooltip.ward.risk * 100)}%</span>
          </div>
          <div className="text-slate-400 mt-0.5">Pop. {(tooltip.ward.population / 1000).toFixed(0)}k</div>
        </div>
      )}

      {/* Map overlay UI elements */}
      {/* Satellite feed watermark */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg"
        style={{ background: 'rgba(10, 14, 26, 0.85)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div className="relative">
          <div className="w-2 h-2 bg-blue-400 rounded-full" />
          <div className="absolute inset-0 w-2 h-2 bg-blue-400 rounded-full"
            style={{ animation: 'radarPulse 2s ease-out infinite' }} />
        </div>
        <span className="text-[11px] font-semibold text-blue-400 tracking-wider">SENTINEL-2 · LIVE</span>
        <span className="text-[10px] text-slate-500 ml-1">BENGALURU</span>
      </div>

      {/* Map zoom controls */}
      <div className="absolute right-4 bottom-24 flex flex-col gap-1">
        {['+', '−'].map((btn) => (
          <button key={btn}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            style={{ background: 'rgba(10,14,26,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {btn}
          </button>
        ))}
        <div className="w-8 h-0.5 bg-white/10 rounded" />
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          style={{ background: 'rgba(10,14,26,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </div>

      {/* Risk Legend */}
      <div className="absolute bottom-4 left-4 px-3 py-2.5 rounded-xl"
        style={{ background: 'rgba(10, 14, 26, 0.92)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Health Risk Index</p>
        <div className="w-36 h-2 rounded-full risk-gradient-bar mb-1.5" />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Healthy</span>
          <span>Moderate</span>
          <span>Critical</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
          <span className="w-3 h-3 rounded-full bg-amber-400/70 border border-amber-400/50 inline-block" />
          <span>Critical alert</span>
        </div>
      </div>

      {/* Ward count badge */}
      <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg text-[11px]"
        style={{ background: 'rgba(10, 14, 26, 0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span className="text-slate-400">Monitoring </span>
        <span className="font-bold text-white">42 wards</span>
        <span className="text-slate-400"> · </span>
        <span className="font-bold text-red-400">7 critical</span>
      </div>
    </div>
  );
}
