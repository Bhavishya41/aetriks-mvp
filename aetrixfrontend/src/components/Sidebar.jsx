import { useState } from 'react';
import { metricMeta } from '../constants';

const metrics = ['temp', 'ndvi', 'aqi'];

export default function Sidebar({ city, activeMetrics, onMetricClick }) {
  const month = typeof city.activeMonthIndex === 'number' ? city.activeMonthIndex : new Date().getMonth();
    const [riskFactor, setRiskFactor] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const fetchPrediction = async () => {
    try {
      setIsPredicting(true);
      const res = await fetch(`https://aetriks-mvp.onrender.com/api/forecast/${city.name.toLowerCase()}`);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        let avgTemp = 0, avgAqi = 0, avgNdvi = 0;
        let count = 0;
        data.features.forEach(f => {
          if (f.predicted_temp !== null) {
            avgTemp += f.predicted_temp;
            avgAqi += f.predicted_air_quality;
            avgNdvi += f.predicted_vegetation;
            count++;
          }
        });
        if (count > 0) {
          setPrediction({
            temp: (avgTemp / count).toFixed(1),
            aqi: (avgAqi / count).toFixed(0),
            ndvi: (avgNdvi / count).toFixed(3)
          });
        }
      }
    } catch (err) {
      console.error("Forecast failed", err);
    } finally {
      setIsPredicting(false);
    }
  };

  const calculateRisk = () => {
    const lstScore = Math.min(100, Math.max(0, (city.lst[month] / 50) * 100));
    const aqiScore = Math.min(100, Math.max(0, (city.aqi[month] / 500) * 100));
    const ndviScore = Math.min(100, Math.max(0, (1 - city.ndvi[month]) * 100));
    
    const score = (aqiScore * 0.4) + (lstScore * 0.4) + (ndviScore * 0.2);
    setRiskFactor(score.toFixed(1));
  };

  const getVal = (m) => {
    switch (m) {
      case 'temp': return typeof city.lst[month] === 'number' ? city.lst[month].toFixed(1) : city.lst[month];
      case 'ndvi': return typeof city.ndvi[month] === 'number' ? city.ndvi[month].toFixed(3) : city.ndvi[month];
      case 'aqi':  return typeof city.aqi[month] === 'number' ? city.aqi[month].toFixed(0) : city.aqi[month];
      default: return '--';
    }
  };

  const getBarPct = (m) => {
    switch (m) {
      case 'temp': return Math.min(100, (city.lst[month] / 50) * 100);
      case 'ndvi': return city.ndvi[month] * 100;
      case 'aqi':  return Math.min(100, (city.aqi[month] / 500) * 100);
      default: return 0;
    }
  };

  const getChange = (m) => {
    const map = { temp: 'Temperature', ndvi: 'Vegetation', aqi: 'Air' };
    const t = city.trends.find(t => t.metric.includes(map[m] || ''));
    return t ? { pct: t.pct, dir: t.direction } : { pct: '--', dir: 'up' };
  };

  return (
    <aside className="app-sidebar">
      <span className="sidebar-label">Environmental Metrics</span>
      {metrics.map(m => {
        const meta = metricMeta[m];
        const change = getChange(m);
        const isActive = activeMetrics && activeMetrics.includes(m);
        return (
          <div
            key={m}
            className={`metric-card${isActive ? ' active' : ''}`}
            data-metric={m}
            onClick={() => onMetricClick(m)}
          >
            <div className="metric-header">
              <input type="checkbox" checked={isActive} readOnly style={{marginRight: '8px'}} />
              <div className="metric-icon-box">{meta.icon}</div>
              <span className="metric-name">{meta.label}</span>
            </div>
            <div className="metric-values">
              <span className="metric-value">{getVal(m)}</span>
              <span className="metric-unit">{meta.unit}</span>
              <span className={`metric-change ${change.dir}`}>{change.pct}</span>
            </div>
            <div className="metric-bar">
              <div className="metric-bar-fill" style={{ width: getBarPct(m) + '%' }} />
            </div>
            <div className="sat-source">
              <span className="sat-dot" />
              <span>{meta.sources[0]}</span>
            </div>
          </div>
        );
      })}


      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={fetchPrediction}
          disabled={isPredicting}
          className="metric-card"
          style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', cursor: isPredicting ? 'wait' : 'pointer', background: 'transparent', color: '#ffffff', fontWeight: 'bold', border: '1px solid #333333', borderRadius: '8px', marginBottom: '12px', transition: 'all 0.2s' }}
        >
          {isPredicting ? 'Predicting...' : "Predict Next Month's Condition"}
        </button>

        {prediction && (
          <div className="metric-card" style={{ marginBottom: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Next Month Forecast</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{color: '#ef5350'}}>Max Temp:</span> 
              <strong>{prediction.temp}°C</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{color: '#43a047'}}>NDVI:</span> 
              <strong>{prediction.ndvi}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{color: '#ffa726'}}>AQI:</span> 
              <strong>{prediction.aqi} µg/m³</strong>
            </div>
          </div>
        )}

        <button
 
          onClick={calculateRisk}
          className="metric-card"
          style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', cursor: 'pointer', background: '#ffffff', color: '#000000', fontWeight: 'bold', border: '1px solid #ffffff', borderRadius: '8px', transition: 'all 0.2s' }}
        >
          Calculate Risk Factor
        </button>

        {riskFactor && (
          <div className="metric-card" style={{ marginTop: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Risk Factor Score</div>
            <div style={{ fontSize: '36px', fontWeight: '800', lineHeight: '1', marginBottom: '4px', color: riskFactor > 70 ? '#ef5350' : riskFactor > 40 ? '#ffa726' : '#43a047' }}>
              {riskFactor}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: riskFactor > 70 ? '#ef5350' : riskFactor > 40 ? '#ffa726' : '#43a047' }}>
              {riskFactor > 70 ? 'High Risk' : riskFactor > 40 ? 'Medium Risk' : 'Low Risk'}
            </div>
          </div>
        )}
      </div>

    </aside>
  );
}
