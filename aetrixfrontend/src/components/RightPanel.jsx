import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { metricMeta, months } from '../constants';

Chart.register(...registerables);

const API = 'http://127.0.0.1:8000';

const colorMap = {
  temp: { line: '#ef5350', bg1: 'rgba(239,83,80,0.25)', bg2: 'rgba(239,83,80,0.01)' },
  ndvi: { line: '#43a047', bg1: 'rgba(67,160,71,0.25)',  bg2: 'rgba(67,160,71,0.01)'  },
  aqi:  { line: '#7c4dff', bg1: 'rgba(124,77,255,0.25)', bg2: 'rgba(124,77,255,0.01)' },
};

/* ─── Spinner ─── */
function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', gap: '14px', opacity: 0.7 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid rgba(124,77,255,0.2)',
        borderTopColor: '#7c4dff',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 13, color: '#9aa0b4' }}>Loading satellite data…</span>
    </div>
  );
}

/* ─── Chart Sub-Component ─── */
function MetricChart({ id, metric, data, forecast }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const ctx = canvasRef.current.getContext('2d');
    const c = colorMap[metric];
    if (!c) return;

    if (chartRef.current) chartRef.current.destroy();

    const grad = ctx.createLinearGradient(0, 0, 0, 170);
    grad.addColorStop(0, c.bg1);
    grad.addColorStop(1, c.bg2);

    const labels    = [...months, 'Jan+', 'Feb+', 'Mar+'];
    const mainData  = [...data, null, null, null];
    const fcData    = new Array(12).fill(null).concat(forecast || []);

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: metricMeta[metric].label,
            data: mainData, borderColor: c.line, backgroundColor: grad,
            borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: c.line,
            pointBorderColor: '#fff', pointBorderWidth: 2, tension: 0.4, fill: true,
          },
          {
            label: 'Forecast',
            data: fcData, borderColor: c.line, borderDash: [6, 4], borderWidth: 2,
            pointRadius: 4, pointBackgroundColor: '#fff', pointBorderColor: c.line,
            pointBorderWidth: 2, pointStyle: 'rectRot', tension: 0.4, fill: false,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#fff', titleColor: '#1a1d2e', bodyColor: '#5a6178',
            borderColor: '#e5e9f0', borderWidth: 1, padding: 12, cornerRadius: 8,
            titleFont: { family: 'Outfit', size: 13, weight: 600 },
            bodyFont: { family: 'Inter', size: 12 },
            callbacks: {
              label: (ctx) =>
                ctx.parsed.y !== null
                  ? `${ctx.dataset.label}: ${ctx.parsed.y} ${metricMeta[metric].unit}`
                  : '',
            },
          },
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9aa0b4', font: { family: 'Inter', size: 10 } } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { color: '#9aa0b4', font: { family: 'Inter', size: 10 } } },
        },
      },
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data, forecast, metric]);

  return (
    <div className="chart-card" id={id}>
      <div className="chart-label">{metricMeta[metric]?.label} — Monthly Trend + Forecast</div>
      <div className="chart-canvas-wrap"><canvas ref={canvasRef} /></div>
    </div>
  );
}

/* ─── Analytics Tab ─── */
function AnalyticsTab({ cityName, panelData }) {
  const anomalies = panelData.anomalies || [];
  const trends    = panelData.trends    || [];
  const crit = anomalies.filter(a => a.severity === 'critical').length;
  const warn = anomalies.filter(a => a.severity === 'warning').length;

  return (
    <div className="fade-in">
      {/* Summary */}
      <div className="analytics-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
        <div className="a-card-head">
          <span className="badge badge-info">ML Summary</span>
          <span className="a-title">Automated Insight — {cityName}</span>
        </div>
        <div className="a-desc">
          <b>{crit} critical</b> and <b>{warn} warning</b> anomalies detected.
          {crit > 0 ? ' Immediate action recommended on critical findings.' : ' All metrics within expected thresholds.'}
        </div>
        <div className="summary-boxes">
          <div className="summary-box critical"><div className="summary-num">{crit}</div><div className="summary-label">Critical</div></div>
          <div className="summary-box warning"><div className="summary-num">{warn}</div><div className="summary-label">Warning</div></div>
          <div className="summary-box trends"><div className="summary-num">{trends.length}</div><div className="summary-label">Trends</div></div>
        </div>
      </div>

      {/* Anomalies */}
      <div className="sidebar-label" style={{ display: 'block', margin: '14px 0 8px', padding: 0 }}>Anomaly Detection</div>
      {anomalies.length === 0 ? (
        <div className="analytics-card" style={{ color: '#9aa0b4', fontSize: 13 }}>No anomalies found in DB for this city.</div>
      ) : anomalies.map((a, i) => (
        <div className="analytics-card fade-in" key={i} style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="a-card-head">
            <span className={`badge badge-${a.severity === 'critical' ? 'critical' : 'warning'}`}>{a.severity}</span>
            <span className="a-title">{a.title}</span>
          </div>
          <div className="a-desc">{a.desc}</div>
          <div className="a-meta">
            <span>{a.source}</span>
            <span>{a.date}</span>
            <span>{Number(a.lat).toFixed(2)}, {Number(a.lng).toFixed(2)}</span>
          </div>
        </div>
      ))}

      {/* Trends */}
      <div className="sidebar-label" style={{ display: 'block', margin: '14px 0 8px', padding: 0 }}>Trend Analysis (Month-over-Month)</div>
      <div className="analytics-card">
        {trends.length === 0 ? (
          <div style={{ color: '#9aa0b4', fontSize: 13 }}>Not enough historical data to compute trends yet.</div>
        ) : trends.map((t, i) => (
          <div className="trend-row" key={i}>
            <span className="trend-label">{t.metric}</span>
            <span className="trend-val">{t.change}</span>
            <span className={`trend-arr ${t.direction}`}>{t.direction === 'up' ? '↑' : '↓'}</span>
            <span className="trend-pct" style={{ color: t.direction === 'up' ? '#ef5350' : '#43a047' }}>{t.pct}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Panel ─── */
export default function RightPanel({ cityName, activeMetrics }) {
  const [tab, setTab]           = useState('charts');
  const [panelData, setPanelData] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // Re-fetch whenever city changes
  useEffect(() => {
    if (!cityName) return;
    let cancelled = false;

    const fetchPanel = async () => {
      setLoading(true);
      setError(null);
      setPanelData(null);
      try {
        const res = await fetch(`${API}/api/city-panel/${encodeURIComponent(cityName.toLowerCase())}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setPanelData(json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPanel();
    return () => { cancelled = true; };
  }, [cityName]);

  // Switch to charts tab when active metrics change
  useEffect(() => {
    if (activeMetrics && activeMetrics.length > 0) setTab('charts');
  }, [activeMetrics]);

  const chartMetrics = activeMetrics && activeMetrics.length > 0
    ? activeMetrics
    : ['temp', 'ndvi', 'aqi'];

  // Map metric key → historical array key returned by panel API
  const dataKey = { temp: 'lst', ndvi: 'ndvi', aqi: 'aqi' };
  const fcKey   = { temp: 'lst', ndvi: 'ndvi', aqi: 'aqi' };

  return (
    <section className="app-panel">
      <div className="panel-tabs">
        {[['charts', 'Charts'], ['analytics', 'Analytics']].map(([k, label]) => (
          <button key={k} className={`panel-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      <div className="panel-body">
        {loading && <Spinner />}

        {!loading && error && (
          <div style={{ padding: '24px', color: '#ef5350', fontSize: 13, lineHeight: 1.6 }}>
            <b>Could not load panel data.</b><br />
            {error}<br />
            <span style={{ color: '#9aa0b4' }}>Make sure the backend is running and data has been ingested for <i>{cityName}</i>.</span>
          </div>
        )}

        {!loading && !error && !panelData && (
          <div style={{ padding: '24px', color: '#9aa0b4', fontSize: 13 }}>
            No data available yet for <b>{cityName}</b>. Trigger the audit pipeline first.
          </div>
        )}

        {!loading && !error && panelData && (
          <>
            {tab === 'charts' && chartMetrics.map(m => (
              <MetricChart
                key={m + cityName}
                id={`chart-${m}`}
                metric={m}
                data={panelData.historical?.[dataKey[m]] || null}
                forecast={panelData.forecast?.[fcKey[m]] || []}
              />
            ))}
            {tab === 'analytics' && <AnalyticsTab cityName={cityName} panelData={panelData} />}
          </>
        )}
      </div>
    </section>
  );
}
