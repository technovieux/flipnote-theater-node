// Simple sun position calculator based on date, time, and geographic coordinates
// Returns ambient light intensity (0-1) and color temperature

export interface SunLightInfo {
  intensity: number; // 0 (night) to 1 (full day)
  color: string; // hex color for the light
  ambientIntensity: number;
  directionalIntensity: number;
  /** Sun direction in scene coords (Z-up). Vector pointing FROM scene origin TOWARD the sun. */
  direction: { x: number; y: number; z: number };
  /** Sun elevation in degrees (positive = above horizon). */
  elevation: number;
  /** Sun azimuth in degrees (0 = north, 90 = east). */
  azimuth: number;
  /** Sky background color (hex). */
  skyColor: string;
  /** Whether sun is visible above the horizon. */
  isDay: boolean;
}

function toJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function getSolarPosition(lat: number, lon: number, date: Date): { elevation: number; azimuth: number } {
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
  const alt = Math.asin(sinAlt);
  // Azimuth (measured from north, clockwise)
  const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(latRad)) / (Math.cos(alt) * Math.cos(latRad));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(ha) > 0) az = 2 * Math.PI - az;
  return { elevation: alt * 180 / Math.PI, azimuth: az * 180 / Math.PI };
}

function sunDirection(elevationDeg: number, azimuthDeg: number) {
  // Z-up scene: +X east, +Y north, +Z up
  const elRad = elevationDeg * Math.PI / 180;
  const azRad = azimuthDeg * Math.PI / 180;
  const cosEl = Math.cos(elRad);
  return {
    x: cosEl * Math.sin(azRad),  // east component
    y: cosEl * Math.cos(azRad),  // north component
    z: Math.sin(elRad),          // up
  };
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
  
  const { elevation, azimuth } = getSolarPosition(latitude, longitude, date);
  const direction = sunDirection(Math.max(elevation, -2), azimuth);
  const isDay = elevation > 0;
  
  // Map elevation to lighting + sky color
  if (elevation > 10) {
    // Daytime
    const t = Math.min(1, (elevation - 10) / 40);
    return {
      intensity: 0.6 + 0.4 * t,
      color: '#ffffff',
      ambientIntensity: 0.4 + 0.3 * t,
      directionalIntensity: 0.8 + 0.4 * t,
      direction,
      elevation,
      azimuth,
      skyColor: t > 0.5 ? '#87ceeb' : '#9ec9e8',
      isDay,
    };
  } else if (elevation > -6) {
    // Golden hour / civil twilight
    const t = (elevation + 6) / 16; // -6 to 10 mapped to 0-1
    const r = Math.round(255);
    const g = Math.round(180 + 75 * t);
    const b = Math.round(100 + 155 * t);
    // sky: orange-red near horizon, fading to blue
    const skyR = Math.round(255 * (1 - t * 0.5));
    const skyG = Math.round(140 + 60 * t);
    const skyB = Math.round(100 + 130 * t);
    return {
      intensity: 0.15 + 0.45 * t,
      color: `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`,
      ambientIntensity: 0.1 + 0.3 * t,
      directionalIntensity: 0.2 + 0.6 * t,
      direction,
      elevation,
      azimuth,
      skyColor: `#${skyR.toString(16).padStart(2,'0')}${skyG.toString(16).padStart(2,'0')}${skyB.toString(16).padStart(2,'0')}`,
      isDay,
    };
  } else if (elevation > -18) {
    // Nautical/astronomical twilight
    const t = (elevation + 18) / 12; // -18 to -6 mapped to 0-1
    return {
      intensity: 0.02 + 0.13 * t,
      color: '#1a1a3a',
      ambientIntensity: 0.02 + 0.08 * t,
      directionalIntensity: 0.0 + 0.2 * t,
      direction,
      elevation,
      azimuth,
      skyColor: `#${Math.round(10 + 30 * t).toString(16).padStart(2,'0')}${Math.round(15 + 30 * t).toString(16).padStart(2,'0')}${Math.round(40 + 40 * t).toString(16).padStart(2,'0')}`,
      isDay,
    };
  } else {
    // Night
    return {
      intensity: 0.02,
      color: '#0a0a1a',
      ambientIntensity: 0.02,
      directionalIntensity: 0.0,
      direction,
      elevation,
      azimuth,
      skyColor: '#05060f',
      isDay,
    };
  }
}
