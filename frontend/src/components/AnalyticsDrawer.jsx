import { useState, useEffect, useRef } from 'react';

// Generate 12 months of environmental data
function generateTimeSeriesData(seed = 0.5) {
  const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  return months.map((month, i) => {
    const trend = seed * 0.6 + (i / 11) * 0.3;
    const noise = (Math.sin(i * 2.5 + seed * 10) * 0.08);
    return {
      month,
      no2: Math.round(20 + (trend + noise) * 80),
      temp: +(25 + (trend + noise * 0.5) * 15).toFixed(1),
      ndvi: +((1 - trend - noise * 0.3) * 0.62 + 0.08).toFixed(2),
      risk: Math.min(0.98, Math.max(0.05, trend + noise)),
    };
  });
}

const CHART_W = 100;
const CHART_H = 60;

function buildPath(points, key, min, max) {
  return points.map((p, i) => {
    const x = (i / (points.length - 1)) * CHART_W;
    const y = CHART_H - ((p[key] - min) / (max - min)) * CHART_H;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function buildAreaPath(points, key, min, max) {
  const linePath = buildPath(points, key, min, max);
  const lastX = CHART_W;
  const firstX = 0;
  return `${linePath} L ${lastX} ${CHART_H} L ${firstX} ${CHART_H} Z`;
}

const METRICS = [
  { key: 'risk', label: 'Risk Index', color: '#ef4444', min: 0, max: 1, unit: '%', multiplier: 100 },
  { key: 'no2', label: 'NO₂ (µg/m³)', color: '#3b82f6', min: 10, max: 120, unit: 'µg/m³', multiplier: 1 },
  { key: 'temp', label: 'Surface Temp', color: '#f97316', min: 22, max: 46, unit: '°C', multiplier: 1 },
  { key: 'ndvi', label: 'NDVI', color: '#22c55e', min: 0, max: 0.8, unit: '', multiplier: 1 },
];

export default function AnalyticsDrawer({ open, onToggle, ward }) {
  const [activeMetric, setActiveMetric] = useState('risk');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [animated, setAnimated] = useState(false);
  const svgRef = useRef(null);

  const data = generateTimeSeriesData(ward?.risk ?? 0.5);
  const metric = METRICS.find(m => m.key === activeMetric);

  useEffect(() => {
    if (open) {
      setAnimated(false);
      const t = setTimeout(() => setAnimated(true), 80);
      return () => clearTimeout(t);
    }
  }, [open, activeMetric, ward]);

  const points = data.map((d, i) => ({
    ...d,
    svgX: (i / (data.length - 1)) * CHART_W,
    svgY: CHART_H - ((d[activeMetric] - metric.min) / (metric.max - metric.min)) * CHART_H,
  }));

  const linePath = buildPath(data, activeMetric, metric.min, metric.max);
  const areaPath = buildAreaPath(data, activeMetric, metric.min, metric.max);

  const handleSvgMouseMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(relX * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    setHoveredPoint(clamped);
  };

  const hp = hoveredPoint !== null ? points[hoveredPoint] : null;

  return (
    <div
      id="analytics-drawer"
      className="drawer-slide w-full flex-shrink-0"
      style={{
        transform: open ? 'translateY(0)' : 'translateY(calc(100% - 44px))',
        background: 'linear-gradient(180deg, #0c1221 0%, #0a0e1a 100%)',
        borderTop: '1px solid rgba(59, 130, 246, 0.15)',
        boxShadow: open ? '0 -8px 40px rgba(0,0,0,0.6)' : 'none',
        height: 280,
      }}
    >
      {/* Drawer handle / header */}
      <button
        id="analytics-drawer-toggle"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 h-11 group"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-4 h-0.5 rounded-full bg-blue-500/60"
                style={{ height: i === 1 ? '6px' : '3px', alignSelf: 'flex-end' }} />
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-300">Environmental Trend Analysis</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
            12 months
          </span>
          {ward && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-slate-400"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {ward.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-slate-500">
            {open ? 'Collapse' : 'Expand'}
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </div>
      </button>

      {/* Chart content */}
      <div className="flex h-[236px] overflow-hidden">
        {/* Metric selector */}
        <div className="flex flex-col gap-1 p-3 border-r border-white/5 w-36 flex-shrink-0">
          <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-widest mb-1 px-1">Metric</p>
          {METRICS.map((m) => (
            <button
              key={m.key}
              id={`metric-btn-${m.key}`}
              onClick={() => setActiveMetric(m.key)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-all ${activeMetric === m.key ? 'text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
              style={activeMetric === m.key ? {
                background: `${m.color}18`,
                border: `1px solid ${m.color}40`,
              } : {}}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
              <span className="font-medium leading-tight">{m.label}</span>
            </button>
          ))}

          {/* Trend summary */}
          <div className="mt-auto p-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">12m Trend</p>
            {(() => {
              const first = data[0][activeMetric];
              const last = data[data.length - 1][activeMetric];
              const change = ((last - first) / first * 100).toFixed(1);
              const isUp = last > first;
              const isBad = (activeMetric === 'ndvi') ? isUp === false : isUp;
              return (
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold" style={{ color: isBad ? '#ef4444' : '#22c55e' }}>
                    {isUp ? '↑' : '↓'}
                  </span>
                  <div>
                    <div className="text-xs font-bold" style={{ color: isBad ? '#ef4444' : '#22c55e' }}>
                      {Math.abs(change)}%
                    </div>
                    <div className="text-[9px] text-slate-600">{isBad ? 'Degrading' : 'Improving'}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* SVG Chart */}
        <div className="flex-1 flex flex-col p-4 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: metric.color, boxShadow: `0 0 6px ${metric.color}` }} />
              <span className="text-[11px] font-semibold text-white">{metric.label}</span>
            </div>
            {hp && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400">{hp.month} 2025</span>
                <span className="font-bold" style={{ color: metric.color }}>
                  {(hp[activeMetric] * metric.multiplier).toFixed(activeMetric === 'ndvi' ? 2 : activeMetric === 'risk' ? 0 : 1)}
                  <span className="text-slate-500 font-normal ml-0.5 text-[10px]">{metric.unit}</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={metric.color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={metric.color} stopOpacity="0.02" />
                </linearGradient>
                <filter id="lineGlow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Y-axis grid lines */}
              {[0.25, 0.5, 0.75].map(frac => (
                <line key={frac} x1="0" y1={CHART_H * frac} x2={CHART_W} y2={CHART_H * frac}
                  stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2,2" />
              ))}

              {/* Area fill */}
              <path d={areaPath} fill="url(#areaGrad)" />

              {/* X month markers */}
              {data.map((d, i) => (
                <line key={d.month}
                  x1={(i / (data.length - 1)) * CHART_W}
                  y1={CHART_H}
                  x2={(i / (data.length - 1)) * CHART_W}
                  y2={CHART_H + 2}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="0.5"
                />
              ))}

              {/* Glow line under */}
              <path d={linePath} fill="none" stroke={metric.color} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                opacity="0.3"
                filter="url(#lineGlow)"
              />

              {/* Main line */}
              <path
                d={linePath}
                fill="none"
                stroke={metric.color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={animated ? 'chart-line-anim' : ''}
                style={{ strokeDasharray: 400, strokeDashoffset: animated ? 0 : 400, transition: 'stroke-dashoffset 1.5s ease' }}
              />

              {/* Data points */}
              {points.map((p, i) => (
                <circle key={i} cx={p.svgX} cy={p.svgY} r={hoveredPoint === i ? 2.5 : 1.2}
                  fill={hoveredPoint === i ? 'white' : metric.color}
                  stroke={metric.color}
                  strokeWidth="0.5"
                  style={{ transition: 'r 0.15s ease' }}
                />
              ))}

              {/* Hover vertical line */}
              {hp && (
                <line x1={hp.svgX} y1="0" x2={hp.svgX} y2={CHART_H}
                  stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="2,2" />
              )}
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between mt-1">
              {data.filter((_, i) => i % 3 === 0 || i === data.length - 1).map((d) => (
                <span key={d.month} className="text-[9px] text-slate-600 font-medium">{d.month}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
