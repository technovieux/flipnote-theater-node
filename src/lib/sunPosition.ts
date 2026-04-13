// Simple sun position calculator based on date, time, and geographic coordinates
// Returns ambient light intensity (0-1) and color temperature

export interface SunLightInfo {
  intensity: number; // 0 (night) to 1 (full day)
  color: string; // hex color for the light
  ambientIntensity: number;
  directionalIntensity: number;
}

function toJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function getSolarElevation(lat: number, lon: number, date: Date): number {
  const jd = toJulianDate(date);
  const n = jd - 2451545.0;
  
  // Mean solar longitude
  const L = (280.46 + 0.9856474 * n) % 360;
  // Mean anomaly
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
  // Ecliptic longitude
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  // Obliquity
  const epsilon = 23.439 * Math.PI / 180;
  // Declination
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  
  // Hour angle
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const ha = ((hours - 12) * 15 + lon) * Math.PI / 180;
  
  const latRad = lat * Math.PI / 180;
  
  // Solar elevation
  const sinAlt = Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(sinAlt) * 180 / Math.PI;
}

export function getSunLightInfo(
  latitude: number,
  longitude: number,
  dateStr: string,
  timeStr: string,
  playbackTimeMs: number = 0
): SunLightInfo {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(dateStr);
  date.setHours(hours, minutes, 0, 0);
  
  // Add playback time
  date.setTime(date.getTime() + playbackTimeMs);
  
  const elevation = getSolarElevation(latitude, longitude, date);
  
  // Map elevation to lighting
  if (elevation > 10) {
    // Daytime
    const t = Math.min(1, (elevation - 10) / 40);
    return {
      intensity: 0.6 + 0.4 * t,
      color: '#ffffff',
      ambientIntensity: 0.4 + 0.3 * t,
      directionalIntensity: 0.8 + 0.4 * t,
    };
  } else if (elevation > -6) {
    // Golden hour / civil twilight
    const t = (elevation + 6) / 16; // -6 to 10 mapped to 0-1
    const r = Math.round(255);
    const g = Math.round(180 + 75 * t);
    const b = Math.round(100 + 155 * t);
    return {
      intensity: 0.15 + 0.45 * t,
      color: `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`,
      ambientIntensity: 0.1 + 0.3 * t,
      directionalIntensity: 0.2 + 0.6 * t,
    };
  } else if (elevation > -18) {
    // Nautical/astronomical twilight
    const t = (elevation + 18) / 12; // -18 to -6 mapped to 0-1
    return {
      intensity: 0.02 + 0.13 * t,
      color: '#1a1a3a',
      ambientIntensity: 0.02 + 0.08 * t,
      directionalIntensity: 0.0 + 0.2 * t,
    };
  } else {
    // Night
    return {
      intensity: 0.02,
      color: '#0a0a1a',
      ambientIntensity: 0.02,
      directionalIntensity: 0.0,
    };
  }
}
