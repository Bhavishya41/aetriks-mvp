// Fetch base API URL from environment variables, fallback to localhost for development
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const fetchForecast = async (cityName) => {
  const res = await fetch(`${API_BASE}/api/forecast/${encodeURIComponent(cityName)}`);
  return res.json();
};

export const fetchWardInsights = async (wardId) => {
  const res = await fetch(`${API_BASE}/api/ward-insights/${wardId}`);
  if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
  return res.json();
};

export const fetchCityPanel = async (cityName) => {
  const res = await fetch(`${API_BASE}/api/city-panel/${encodeURIComponent(cityName)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const triggerEnvironmentalAudit = async (cityName) => {
  const res = await fetch(`${API_BASE}/api/environmental-audit/${encodeURIComponent(cityName)}`);
  if (!res.ok) throw new Error('Audit trigger failed');
  return res.json();
};

export const fetchTaskStatus = async (taskId) => {
  const res = await fetch(`${API_BASE}/api/task-status/${taskId}`);
  return res.json();
};

export const sendChatMessage = async (body) => {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
};

export const fetchGeocode = async (cityName) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`
  );
  return res.json();
};
