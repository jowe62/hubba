import { SunDetails, SunWindow } from '../types';

/**
 * Calculates both solar altitude and azimuth (compass direction) in degrees.
 */
export function getSolarCoordinates(lat: number, lng: number, date: Date) {
  const rad = Math.PI / 180;
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  
  // Declination
  const declination = 23.45 * Math.sin(rad * (360 / 365) * (284 + day));
  
  // Local solar time
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarTimeDiff = lng / 15.0;
  const solarTime = (utcHours + solarTimeDiff) % 24;
  const hourAngle = (solarTime - 12) * 15;
  
  const latRad = lat * rad;
  const declRad = declination * rad;
  const hrRad = hourAngle * rad;
  
  // Solar elevation angle
  const sinAltitude = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hrRad);
  const altitude = Math.asin(sinAltitude) / rad;
  
  // Solar compass azimuth calculation
  const cosAzimuth = (Math.sin(declRad) - Math.sin(latRad) * sinAltitude) / (Math.cos(latRad) * Math.cos(Math.asin(sinAltitude)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) / rad;
  
  // Adjust azimuth depending on before/after solar noon
  if (hourAngle > 0) {
    azimuth = 360 - azimuth;
  } else {
    azimuth = azimuth;
  }
  
  return { altitude, azimuth };
}

/**
 * Evaluates whether a point is in direct sun, checking against its horizon mask.
 */
export function isPointInSun(altitude: number, azimuth: number, horizonMask?: number[]): boolean {
  if (altitude <= 0) return false; // Below horizon
  if (!horizonMask || horizonMask.length !== 36) return true; // Default to no-obstruction MVP math
  
  // Match the sun's heading to the nearest 10-degree bin index (0-35)
  const binIndex = Math.round(azimuth / 10) % 36;
  const obstructionElevation = horizonMask[binIndex];
  
  // Sun is in view if its altitude exceeds the roof obstacle height
  return altitude > obstructionElevation;
}

/**
 * Computes direct sun windows and durations using the real V2 structural shadow model.
 */
export function calculateSunDetails(
  lat: number,
  lng: number,
  evaluatedTime: Date,
  horizonMask?: number[],
  startHour = 8,
  endHour = 22
): SunDetails {
  const testDate = new Date(evaluatedTime);
  const { altitude: currAlt, azimuth: currAz } = getSolarCoordinates(lat, lng, testDate);
  const inSunNow = isPointInSun(currAlt, currAz, horizonMask);
  
  const sunWindows: SunWindow[] = [];
  let totalSunMinutes = 0;
  let windowStart: string | null = null;
  const baseYear = testDate.getFullYear();
  const baseMonth = testDate.getMonth();
  const baseDay = testDate.getDate();

  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 10) {
      const sampleTime = new Date(baseYear, baseMonth, baseDay, hour, min, 0);
      const { altitude, azimuth } = getSolarCoordinates(lat, lng, sampleTime);
      const isSun = isPointInSun(altitude, azimuth, horizonMask);
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      
      if (isSun) {
        totalSunMinutes += 10;
        if (windowStart === null) {
          windowStart = timeStr;
        }
      } else {
        if (windowStart !== null) {
          sunWindows.push({ start: windowStart, end: timeStr });
          windowStart = null;
        }
      }
    }
  }
  
  if (windowStart !== null) {
    sunWindows.push({ start: windowStart, end: `${endHour}:00` });
  }
  
  return {
    inSunNow,
    sunWindows,
    totalSunMinutes
  };
}