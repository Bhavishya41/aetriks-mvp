// Pure UI constants — no mock/dummy data here.

export const metricMeta = {
  temp: {
    label: 'Land Surface Temp',
    unit: '°C',
    icon: '🌡️',
    sources: ['MODIS MOD11A2'],
  },
  ndvi: {
    label: 'Vegetation Index',
    unit: 'NDVI',
    icon: '🌿',
    sources: ['MODIS MOD13A1'],
  },
  aqi: {
    label: 'Air Quality (NO₂)',
    unit: 'µg/m³',
    icon: '💨',
    sources: ['Sentinel-5P'],
  },
  soil: {
    label: 'Soil Moisture',
    unit: 'm³/m³',
    icon: '🪨',
    sources: ['Sentinel-1 SAR'],
  },
};

export const months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Static satellite status — represents live satellite missions, not dummy city data
export const satellites = [
  { id: 's5p',   name: 'Sentinel-5P', status: 'active' },
  { id: 'mod',   name: 'MODIS Terra',  status: 'active' },
  { id: 's1',    name: 'Sentinel-1',   status: 'active' },
  { id: 'lnd',   name: 'Landsat 9',    status: 'standby' },
];
