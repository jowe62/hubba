export interface OutdoorPoint {
  lat: number;
  lng: number;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  hasOutdoor: boolean;
  tags: string[];
  notes?: string;
  outdoorPoint?: OutdoorPoint;
  horizonMask?: number[]; // Added in V2
}

export interface SunWindow {
  start: string;
  end: string;
}

export interface SunDetails {
  inSunNow: boolean;
  sunWindows: SunWindow[];
  totalSunMinutes: number;
}