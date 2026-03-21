import { useState, useEffect } from 'react';
import { satellites } from './constants';
import Sidebar from './components/Sidebar';
import MapView from './components/MapView';
import RightPanel from './components/RightPanel';
import SentinelChat from './components/SentinelChat';
import './index.css';

const API = 'http://127.0.0.1:8000';

/* ─── Helpers ─── */
const generateMapElements = (center, currentMetrics) => {
  const [lat, lng] = center;
  const { temp = 30, ndvi = 0.5, aqi = 100 } = currentMetrics;

  const heatmap = Array.from({ length: 20 }, () => [
    lat + (Math.random() - 0.5) * 0.1,
    lng + (Math.random() - 0.5) * 0.1,
    Math.random() * 0.8 + 0.2,
  ]);

  const ndviGrid = Array.from({ length: 5 }, (_, i) => {
    const cLat = lat + (Math.random() - 0.5) * 0.1;
    const cLng = lng + (Math.random() - 0.5) * 0.1;
    return {
      bounds: [[cLat - 0.02, cLng - 0.02], [cLat + 0.02, cLng + 0.02]],
      value: Math.max(0, Math.min(1, ndvi + (Math.random() - 0.5) * 0.2)),
      label: `Sector ${i + 1}`,
    };
  });

  const aqiStations = Array.from({ length: 4 }, (_, i) => ({
    id: `station-${i}`,
    name: `Station ${i + 1}`,
    lat: lat + (Math.random() - 0.5) * 0.1,
    lng: lng + (Math.random() - 0.5) * 0.1,
    aqi: Math.max(0, Math.round(aqi + (Math.random() - 0.5) * 50)),
    pm25: Math.max(0, Math.round((aqi + (Math.random() - 0.5) * 50) / 2)),
  }));

  return { heatmap, ndviGrid, aqiStations };
};

/* ─── Minimal city shape for MapView / Sidebar while data loads ─── */
const blankCity = (name, center) => ({
  name,
  state: '',
  population: '—',
  area: '—',
  center: center || [28.6139, 77.209],
  zoom: 11,
  lst:  new Array(12).fill(null),
  aqi:  new Array(12).fill(null),
  ndvi: new Array(12).fill(null),
  forecast: { lst: [], aqi: [], ndvi: [] },
  anomalies: [],
  trends: [],
  heatmap: [], ndviGrid: [], aqiStations: [],
  activeMonthIndex: new Date().getMonth(),
});

export default function App() {
  const [cityKey, setCityKey]         = useState('delhi');
  const [searchInput, setSearchInput] = useState('');
  const [activeMetrics, setActiveMetrics] = useState([]);

  // What MapView / Sidebar display — built from panel data
  const [mapCity, setMapCity]   = useState(blankCity('Delhi', [28.6139, 77.209]));
  const [isLoading, setIsLoading] = useState(false);

  /* ── Geocode + audit trigger whenever city changes ───────────────────── */
  useEffect(() => {
    if (!cityKey) return;
    let cancelled = false;

    const cityName = cityKey.charAt(0).toUpperCase() + cityKey.slice(1);
    setMapCity(blankCity(cityName));
    setIsLoading(true);

    const run = async () => {
      /* 1. Geocode via Nominatim to get a center coordinate */
      let center = [28.6139, 77.209];
      try {
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityKey)}&limit=1`
        );
        const geoData = await geo.json();
        if (geoData?.[0]) {
          center = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];
        }
      } catch (_) { /* silent — fall back to default */ }

      if (cancelled) return;
      setMapCity(blankCity(cityName, center));

      /* 2. Trigger audit pipeline (cache check + optional background job) */
      try {
        const auditRes = await fetch(`${API}/api/environmental-audit/${encodeURIComponent(cityName)}`);
        if (!auditRes.ok) throw new Error('Audit trigger failed');
        const audit = await auditRes.json();

        const buildMapCity = async (bbox) => {
          /* 3. Fetch aggregated panel data */
          try {
            const panelRes = await fetch(`${API}/api/city-panel/${encodeURIComponent(cityName.toLowerCase())}`);
            if (!panelRes.ok) throw new Error('Panel fetch failed');
            const panel = await panelRes.json();

            if (cancelled) return;

            const usedCenter = bbox
              ? [(bbox.south + bbox.north) / 2, (bbox.west + bbox.east) / 2]
              : center;

            const lst  = panel.historical?.lst  || new Array(12).fill(null);
            const aqi  = panel.historical?.aqi  || new Array(12).fill(null);
            const ndvi = panel.historical?.ndvi || new Array(12).fill(null);

            // Find the latest month that has real data
            let latestIdx = 11;
            for (let i = 11; i >= 0; i--) {
              if (lst[i] !== null || aqi[i] !== null || ndvi[i] !== null) {
                latestIdx = i; break;
              }
            }

            const currentMetrics = {
              temp: lst[latestIdx]  ?? 30,
              ndvi: ndvi[latestIdx] ?? 0.5,
              aqi:  aqi[latestIdx]  ?? 100,
            };
            const mapEls = generateMapElements(usedCenter, currentMetrics);

            setMapCity({
              name: cityName,
              state: '', population: '—', area: '—',
              center: usedCenter, zoom: 12,
              lst, aqi, ndvi,
              forecast: panel.forecast  || { lst: [], aqi: [], ndvi: [] },
              anomalies: panel.anomalies || [],
              trends: panel.trends       || [],
              activeMonthIndex: latestIdx,
              ...mapEls,
            });
          } catch (err) {
            console.error('Panel fetch failed:', err);
          } finally {
            if (!cancelled) setIsLoading(false);
          }
        };

        if (audit.status === 'cached') {
          await buildMapCity(audit.bbox);
        } else if (audit.status === 'pending') {
          const taskId = audit.task_id;
          const poll = setInterval(async () => {
            try {
              const statusRes = await fetch(`${API}/api/task-status/${taskId}`);
              const statusData = await statusRes.json();
              if (statusData.status === 'completed') {
                clearInterval(poll);
                const bbox = statusData.result?.bbox || audit.bbox;
                await buildMapCity(bbox);
              } else if (statusData.status === 'failed') {
                clearInterval(poll);
                if (!cancelled) setIsLoading(false);
              }
            } catch (_) { clearInterval(poll); if (!cancelled) setIsLoading(false); }
          }, 3000);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Audit trigger error:', err);
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [cityKey]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const v = searchInput.trim().toLowerCase();
      if (v) { setCityKey(v); setActiveMetrics([]); }
    }
  };

  const handleMetricClick = (metric) => {
    setActiveMetrics(prev =>
      prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
    );
  };

  return (
    <>
      <div className="app-layout">
        {/* ── Header ── */}
        <header className="app-header">
          <div className="logo">
            <div className="logo-icon" />
            <span className="logo-text">AETRIX</span>
          </div>
          <span className="city-info">
            {mapCity.name}
            {isLoading && <span style={{ marginLeft: 10, fontSize: 12, color: '#7c4dff', opacity: 0.8 }}>⏳ syncing…</span>}
          </span>

          <div className="header-controls">
            <div className="select-box">
              <label htmlFor="city-search">City</label>
              <input
                id="city-search"
                type="text"
                placeholder="Search City…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={handleSearch}
                className="bg-slate-800 text-white placeholder-slate-400 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 transition-all"
              />
            </div>
            <div className="select-box">
              <label>Period</label>
              <select defaultValue="12m">
                <option value="12m">Last 12 Months</option>
                <option value="6m">Last 6 Months</option>
                <option value="3m">Last 3 Months</option>
              </select>
            </div>
          </div>
        </header>

        {/* ── Sidebar ── */}
        <Sidebar city={mapCity} activeMetrics={activeMetrics} onMetricClick={handleMetricClick} />

        {/* ── Map ── */}
        <MapView city={mapCity} activeMetrics={activeMetrics} />

        {/* ── Right Panel — self-fetching, only needs city name ── */}
        <RightPanel cityName={mapCity.name} activeMetrics={activeMetrics} />

        {/* ── Footer ── */}
        <footer className="app-footer">
          <span style={{ fontWeight: 700, letterSpacing: '1px' }}>SATELLITE STATUS</span>
          {satellites.map(s => (
            <div className="sat-badge" key={s.id}>
              <span className={`dot ${s.status}`} />
              <span>{s.name}</span>
            </div>
          ))}
          <div className="footer-right">
            Last Sync: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST
          </div>
        </footer>

        {/* Floating Chatbot */}
        <SentinelChat />
      </div>
    </>
  );
}
