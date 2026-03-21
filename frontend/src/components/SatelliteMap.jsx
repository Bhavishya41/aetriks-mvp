import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// To use this fully, set VITE_MAPBOX_TOKEN in your .env file
// If it's missing, it will use the placeholder (which will fail if invalid, so replace it!)
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_ACCESS_TOKEN_HERE';

const DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';
const SATELLITE_STYLE = 'mapbox://styles/mapbox/satellite-streets-v12';

function generateCirclePolygon(center, radius) {
  const points = 32;
  const coords = [];
  const [lng, lat] = center;
  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    // Mapbox GL JS requires longitude adjustment to maintain circular shape
    const latAdjust = Math.cos((lat * Math.PI) / 180);
    const dLng = (radius / latAdjust) * Math.cos(angle);
    const dLat = radius * Math.sin(angle);
    coords.push([lng + dLng, lat + dLat]);
  }
  return [coords];
}

const rawWards = [
  { id: 'W01', name: 'Koramangala', health_risk_score: 78, risk: 0.78, population: 182000, center: [77.625, 12.93], radius: 0.015 },
  { id: 'W02', name: 'Indiranagar', health_risk_score: 55, risk: 0.55, population: 145000, center: [77.64, 12.98], radius: 0.012 },
  { id: 'W08', name: 'Bommanahalli', health_risk_score: 95, risk: 0.95, population: 278000, center: [77.625, 12.90], radius: 0.016 },
  { id: 'W15', name: 'Electronic City', health_risk_score: 82, risk: 0.82, population: 387000, center: [77.665, 12.845], radius: 0.018 },
  { id: 'W06', name: 'Rajajinagar', health_risk_score: 31, risk: 0.31, population: 167000, center: [77.55, 12.99], radius: 0.014 }
];

const MOCK_WARDS_GEOJSON = {
  type: 'FeatureCollection',
  features: rawWards.map(w => ({
    type: 'Feature',
    properties: w,
    geometry: { type: 'Polygon', coordinates: generateCirclePolygon(w.center, w.radius) }
  }))
};

export default function SatelliteMap({ onWardSelect, selectedWard }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapStyle, setMapStyle] = useState(DARK_STYLE);

  // Initialize Mapbox map
  useEffect(() => {
    if (mapRef.current) return; // Prevent multiple initializations

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [77.62, 12.92], // Bengaluru rough center
      zoom: 11,
      pitch: 45, // Tilted for 3D extrusion view
      bearing: -17.6,
      antialias: true,
      projection: 'globe' // Globe view when zoomed out
    });

    mapRef.current = map;

    // We wait for the style to load to add layers, and this event fires again whenever mapStyle changes via setStyle
    map.on('style.load', () => {
      // 1. Atmosphere (fog) for high-end cinematic look
      const isSatellite = map.getStyle()?.name?.includes('Satellite');
      map.setFog({
        'color': isSatellite ? 'rgb(186, 210, 235)' : 'rgb(12, 20, 31)', 
        'high-color': 'rgb(36, 92, 223)',
        'horizon-blend': 0.02,
        'space-color': isSatellite ? 'rgb(11, 11, 25)' : 'rgb(2, 4, 9)',
        'star-intensity': 0.6
      });

      // 2. Add GeoJSON source
      if (!map.getSource('wards')) {
        map.addSource('wards', {
          type: 'geojson',
          data: MOCK_WARDS_GEOJSON
        });
      }

      // 3. Add 3D Extrusion Layer
      if (!map.getLayer('ward-extrusions')) {
        map.addLayer({
          id: 'ward-extrusions',
          type: 'fill-extrusion',
          source: 'wards',
          paint: {
            'fill-extrusion-color': [
              'step',
              ['get', 'health_risk_score'],
              '#22c55e', // Green for 0-40 (and defaulting lower values)
              41, '#f59e0b', // Amber for 41-70
              71, '#ef4444'  // Red for 71-100
            ],
            // Scale up the health_risk_score to make extrusion visibly tall
            'fill-extrusion-height': [
              '*',
              ['get', 'health_risk_score'],
              60 
            ],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.85
          }
        });
      }
    });

    // Handle clicks on the extrusions layer
    map.on('click', 'ward-extrusions', (e) => {
      if (!e.features.length) return;
      
      const feature = e.features[0];
      const wardData = feature.properties;
      
      // Calculate a rough bounding center for the flying animation
      const coords = feature.geometry.coordinates[0];
      let lngSum = 0, latSum = 0, pts = coords.length;
      coords.forEach(coord => {
        lngSum += coord[0];
        latSum += coord[1];
      });
      const center = [lngSum / pts, latSum / pts];

      // cinematic fly-to animation
      map.flyTo({
        center: center,
        zoom: 13.5,
        pitch: 65,
        essential: true,
        duration: 2500
      });

      if (onWardSelect) {
        onWardSelect(wardData);
      }
    });

    // Pointer cursor on hover
    map.on('mouseenter', 'ward-extrusions', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'ward-extrusions', () => {
      map.getCanvas().style.cursor = '';
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update style without recreating the map instance
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(mapStyle);
  }, [mapStyle]);

  const toggleSatellite = () => {
    setMapStyle(prev => prev === DARK_STYLE ? SATELLITE_STYLE : DARK_STYLE);
  };

  return (
    <div className="relative w-full h-full bg-slate-900">
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      {/* Satellite Toggle Button */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={toggleSatellite}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:bg-white/10"
          style={{
            background: 'rgba(10, 14, 26, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#fff',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          {mapStyle === DARK_STYLE ? 'Satellite Streets' : 'Dark Vector'}
        </button>
      </div>

      {/* Live Badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg pointer-events-none"
        style={{ background: 'rgba(10, 14, 26, 0.85)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div className="relative">
          <div className="w-2 h-2 bg-blue-400 rounded-full" />
          <div className="absolute inset-0 w-2 h-2 bg-blue-400 rounded-full"
            style={{ animation: 'radarPulse 2s ease-out infinite' }} />
        </div>
        <span className="text-[11px] font-semibold text-blue-400 tracking-wider">MAPBOX GL · LIVE</span>
        <span className="text-[10px] text-slate-500 ml-1">BENGALURU</span>
      </div>

      {/* Extrusion Legend */}
      <div className="absolute bottom-8 left-4 px-3 py-2.5 rounded-xl pointer-events-none z-10"
        style={{ background: 'rgba(10, 14, 26, 0.92)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">3D Extrusion Data</p>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wide">Height</span>
            <span className="text-[11px] font-bold text-white">Health Risk Score</span>
          </div>
          <div className="w-px h-6 bg-slate-700" />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-[#22c55e] opacity-80" />
              <span className="text-[9px] text-slate-400">Green <span className="opacity-50">(0-40)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-[#f59e0b] opacity-80" />
              <span className="text-[9px] text-slate-400">Amber <span className="opacity-50">(41-70)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-[#ef4444] opacity-80" />
              <span className="text-[9px] text-slate-400">Red <span className="opacity-50">(71-100)</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
