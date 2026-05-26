import { SunDetails, SunWindow } from '../types';

export function getSolarAltitude(lat: number, lng: number, date: Date): number {
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
  return Math.asin(sinAltitude) / rad;
}

export function calculateSunDetails(
  lat: number,
  lng: number,
  evaluatedTime: Date,
  startHour = 8,
  endHour = 22
): SunDetails {
  const testDate = new Date(evaluatedTime);
  const currentAltitude = getSolarAltitude(lat, lng, testDate);
  const inSunNow = currentAltitude > 0;
  
  const sunWindows: SunWindow[] = [];
  let totalSunMinutes = 0;
  let windowStart: string | null = null;
  const baseYear = testDate.getFullYear();
  const baseMonth = testDate.getMonth();
  const baseDay = testDate.getDate();

  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += 10) {
      const sampleTime = new Date(baseYear, baseMonth, baseDay, hour, min, 0);
      const alt = getSolarAltitude(lat, lng, sampleTime);
      const isSun = alt > 0;
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
