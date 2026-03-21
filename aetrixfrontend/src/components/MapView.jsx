import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

const legends = {
  temp: { title: 'Surface Temperature', items: [
    { color: '#d50000', label: 'Extreme (>42°C)' }, { color: '#f44336', label: 'Very Hot (36–42°C)' },
    { color: '#ff9800', label: 'Hot (30–36°C)' }, { color: '#2196f3', label: 'Moderate (<30°C)' }
  ]},
  ndvi: { title: 'Vegetation Health (NDVI)', items: [
    { color: '#2e7d32', label: 'Dense (>0.5)' }, { color: '#66bb6a', label: 'Moderate (0.35–0.5)' },
    { color: '#c0ca33', label: 'Sparse (0.25–0.35)' }, { color: '#ffa726', label: 'Low (0.15–0.25)' },
    { color: '#e53935', label: 'Very Low (<0.15)' }
  ]},
  aqi: { title: 'Air Quality Index', items: [
    { color: '#7b1fa2', label: 'Hazardous (>300)' }, { color: '#ff5252', label: 'Very Unhealthy (200–300)' },
    { color: '#ffa726', label: 'Unhealthy (100–200)' }, { color: '#c6ff00', label: 'Moderate (50–100)' },
    { color: '#00e676', label: 'Good (<50)' }
  ]}
};

function ndviColor(v) {
  if (v >= 0.5) return '#2e7d32';
  if (v >= 0.35) return '#66bb6a';
  if (v >= 0.25) return '#c0ca33';
  if (v >= 0.15) return '#ffa726';
  return '#e53935';
}

function aqiColor(v) {
  if (v <= 50) return '#00e676';
  if (v <= 100) return '#c6ff00';
  if (v <= 200) return '#ffa726';
  if (v <= 300) return '#ff5252';
  return '#7b1fa2';
}

export default function MapView({ city, activeMetrics }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef({});
  const [basemap, setBasemap] = useState('dark');

  const darkTile = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const satTile = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false });
    L.control.zoom({ position: 'topright' }).addTo(map);
    layersRef.current.tileLayer = L.tileLayer(darkTile, { maxZoom: 18 }).addTo(map);
    map.setView(city.center, city.zoom);
    mapInstance.current = map;
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    map.flyTo(city.center, city.zoom, { duration: 1 });
    clearLayers(map);
    showHotspots(map, city);
    if (activeMetrics && activeMetrics.length > 0) {
      activeMetrics.forEach(metric => showLayer(map, metric, city));
    }
  }, [city, activeMetrics]);

  const clearLayers = (map) => {
    ['heat', 'ndvi', 'aqi', 'soil', 'land', 'hotspot'].forEach(k => {
      if (layersRef.current[k]) {
        map.removeLayer(layersRef.current[k]);
        layersRef.current[k] = null;
      }
    });
  };

  const showLayer = (map, metric, c) => {
    switch (metric) {
      case 'temp': {
        const pts = c.heatmap.map(p => [p[0], p[1], p[2]]);
        layersRef.current.heat = L.heatLayer(pts, {
          radius: 35, blur: 25, maxZoom: 14,
          gradient: { 0.2: '#2196f3', 0.5: '#ff9800', 0.7: '#f44336', 1: '#d50000' }
        }).addTo(map);
        break;
      }
            case 'ndvi': {
        const pts = [];
        for (let i = 0; i < 80; i++) {
          pts.push([
            c.center[0] + (Math.random() - 0.5) * 0.15,
            c.center[1] + (Math.random() - 0.5) * 0.15,
            Math.random()
          ]);
        }
        layersRef.current.ndvi = L.heatLayer(pts, {
          radius: 35, blur: 25, maxZoom: 14,
          gradient: { 0.2: '#e53935', 0.4: '#ffa726', 0.6: '#c0ca33', 0.8: '#66bb6a', 1: '#2e7d32' }
        }).addTo(map);
        break;
      }
      case 'aqi': {
        const pts = [];
        for (let i = 0; i < 80; i++) {
          pts.push([
            c.center[0] + (Math.random() - 0.5) * 0.15,
            c.center[1] + (Math.random() - 0.5) * 0.15,
            Math.random()
          ]);
        }
        layersRef.current.aqi = L.heatLayer(pts, {
          radius: 35, blur: 25, maxZoom: 14,
          gradient: { 0.2: '#00e676', 0.4: '#c6ff00', 0.6: '#ffa726', 0.8: '#ff5252', 1: '#7b1fa2' }
        }).addTo(map);
        break;
      }
    }
  };

  const showHotspots = (map, c) => {
    const g = L.layerGroup();
    c.anomalies.forEach(a => {
      const icon = L.divIcon({ className: '', html: '<div class="hotspot-pulse"></div>', iconSize: [16,16] });
      L.marker([a.lat, a.lng], { icon })
        .bindPopup(`<b style="color:#ef5350">${a.title}</b><br>${a.desc}<br><span style="color:#999;font-size:11px">${a.source} · ${a.date}</span>`)
        .addTo(g);
    });
    g.addTo(map);
    layersRef.current.hotspot = g;
  };

  const switchBase = (type) => {
    const map = mapInstance.current;
    if (!map) return;
    if (layersRef.current.tileLayer) map.removeLayer(layersRef.current.tileLayer);
    layersRef.current.tileLayer = L.tileLayer(type === 'satellite' ? satTile : darkTile, { maxZoom: 18 }).addTo(map);
    setBasemap(type);
  };

  const activeLegends = activeMetrics ? activeMetrics.map(m => legends[m]).filter(Boolean) : [];

  return (
    <main className="app-map">
      <div ref={mapRef} className="map-container" />
      <div className="map-controls">
        <button className={`map-btn${basemap === 'dark' ? ' active' : ''}`} onClick={() => switchBase('dark')}>Dark Map</button>
        <button className={`map-btn${basemap === 'satellite' ? ' active' : ''}`} onClick={() => switchBase('satellite')}>Satellite</button>
      </div>
      {activeLegends.length > 0 && (
        <div className="map-legend fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#0a0a0a', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid var(--border)' }}>
          {activeLegends.map((legend, idx) => (
            <div key={idx}>
              <h4 style={{color: '#94a3b8'}}>{legend.title}</h4>
              <div className="legend-items">
                {legend.items.map((it, i) => (
                  <div className="legend-item" style={{color: '#cbd5e1'}} key={i}>
                    <span className="legend-swatch" style={{ background: it.color }} />
                    {it.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
