import { SunDetails, SunWindow } from '../types';

/**
 * Smarter building-type based height fallbacks for Gothenburg structures
 */
export function estimateBuildingHeight(tags: any): number {
  if (tags.height) {
    return parseFloat(tags.height);
  }
  if (tags['building:levels']) {
    const levels = parseFloat(tags['building:levels']);
    return levels * 3.1; // 3.1m per level
  }
  const type = tags.building || 'yes';
  if (type === 'garage' || type === 'shed' || type === 'carport') return 3.0;
  if (type === 'house' || type === 'detached' || type === 'semidetached') return 8.0;
  if (type === 'apartments' || type === 'residential') return 16.0;
  if (type === 'commercial' || type === 'office' || type === 'retail') return 18.0;
  if (type === 'industrial' || type === 'warehouse') return 12.0;
  return 14.0; // General urban fallback
}

/**
 * Distance and compass Azimuth calculation between coordinates
 */
export function getDistanceAndAzimuth(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const latMean = ((lat1 + lat2) / 2) * rad;
  const dy = (lat2 - lat1) * 111139;
  const dx = (lon2 - lon1) * 111139 * Math.cos(latMean);
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  let azimuth = Math.atan2(dx, dy) * (180 / Math.PI);
  if (azimuth < 0) azimuth += 360;
  
  return { distance, azimuth };
}

/**
 * Calculates both solar altitude and azimuth in degrees.
 */
export function getSolarCoordinates(lat: number, lng: number, date: Date) {
  const rad = Math.PI / 180;
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const day = Math.floor(diff / oneDay);
  
  const declination = 23.45 * Math.sin(rad * (360 / 365) * (284 + day));
  
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarTimeDiff = lng / 15.0;
  const solarTime = (utcHours + solarTimeDiff) % 24;
  const hourAngle = (solarTime - 12) * 15;
  
  const latRad = lat * rad;
  const declRad = declination * rad;
  const hrRad = hourAngle * rad;
  
  const sinAltitude = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hrRad);
  const altitude = Math.asin(sinAltitude) / rad;
  
  const cosAzimuth = (Math.sin(declRad) - Math.sin(latRad) * sinAltitude) / (Math.cos(latRad) * Math.cos(Math.asin(sinAltitude)));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) / rad;
  
  if (hourAngle > 0) {
    azimuth = 360 - azimuth;
  }
  
  return { altitude, azimuth };
}

/**
 * Evaluates whether a point is in direct sun, checking against its 72-point horizon mask.
 */
export function isPointInSun(altitude: number, azimuth: number, horizonMask?: number[]): boolean {
  if (altitude <= 0) return false;
  if (!horizonMask) return true;
  
  const expectedLength = horizonMask.length;
  if (expectedLength !== 72 && expectedLength !== 36) return true; // Graceful fallback
  
  // Match sun's heading to nearest bin
  if (expectedLength === 72) {
    const binIndex = Math.round(azimuth / 5) % 72; // 5-degree steps
    return altitude > horizonMask[binIndex];
  } else {
    const binIndex = Math.round(azimuth / 10) % 36; // 10-degree steps (V2 backward compatibility)
    return altitude > horizonMask[binIndex];
  }
}

/**
 * Computes direct sun windows and durations using the 72-point shading model.
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

// Mirror server pool to bypass rate limits
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];

async function fetchOSMWithFallback(query: string): Promise<any> {
  let lastError: any = null;
  for (const server of OVERPASS_SERVERS) {
    try {
      const url = `${server}?data=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'HabbaClientAdjuster/1.0 (contact: jowe62 on github)'
        }
      });
      if (res.ok) {
        return await res.json();
      } else {
        throw new Error(`Status ${res.status}`);
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(lastError ? lastError.message : "All servers failed");
}

/**
 * CLIENT-SIDE 3D SHADING ENGINE
 * Compiles a 72-bin (5-degree) horizon mask directly inside the client's browser
 */
export async function recomputeClientHorizonMask(lat: number, lng: number): Promise<number[]> {
  const query = `
    [out:json];
    (
      way["building"](around:150, ${lat}, ${lng});
      relation["building"](around:150, ${lat}, ${lng});
    );
    out body;
    >;
    out skel qt;
  `;
  
  const osmData = await fetchOSMWithFallback(query);
  const mask = new Array(72).fill(0);
  const nodes: { [key: string]: { lat: number; lon: number } } = {};

  osmData.elements.forEach((el: any) => {
    if (el.type === 'node') {
      nodes[el.id] = { lat: el.lat, lon: el.lon };
    }
  });

  osmData.elements.forEach((el: any) => {
    if (el.type === 'way' && el.nodes && el.tags) {
      const height = estimateBuildingHeight(el.tags);

      for (let i = 0; i < el.nodes.length - 1; i++) {
        const nodeA = nodes[el.nodes[i]];
        const nodeB = nodes[el.nodes[i + 1]];
        if (!nodeA || !nodeB) continue;

        const { distance: segmentLen } = getDistanceAndAzimuth(nodeA.lat, nodeA.lon, nodeB.lat, nodeB.lon);
        const steps = Math.max(1, Math.floor(segmentLen / 2));
        
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const pointLat = nodeA.lat + (nodeB.lat - nodeA.lat) * t;
          const pointLon = nodeA.lon + (nodeB.lon - nodeA.lon) * t;

          const { distance, azimuth } = getDistanceAndAzimuth(lat, lng, pointLat, pointLon);
          if (distance < 3) continue;

          const elevation = Math.atan2(height, distance) * (180 / Math.PI);
          const binIndex = Math.round(azimuth / 5) % 72; // 5-degree increments

          if (elevation > mask[binIndex]) {
            mask[binIndex] = Math.round(elevation);
          }
        }
      }
    }
  });

  return mask;
}