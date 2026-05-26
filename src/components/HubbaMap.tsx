import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Venue } from '../types';
import { calculateSunDetails, getSolarCoordinates, isPointInSun } from '../utils/sunUtils';

interface HubbaMapProps {
  venues: Venue[];
  selectedVenue: Venue | null;
  onSelectVenue: (venue: Venue) => void;
  evaluatedTime: Date;
  isAdjustingPoint: boolean;
  onUpdateOutdoorPoint: (id: string, lat: number, lng: number) => void;
  userLocation: { lat: number; lng: number } | null;
  onBoundsChange: (bounds: L.LatLngBounds) => void;
  targetCenter: { lat: number; lng: number; zoom?: number } | null;
}

// Calculates consecutive remaining sunny hours from the current selected time forward
function getRemainingSunHours(venue: Venue, evaluatedTime: Date): number {
  const activeLat = venue.outdoorPoint?.lat ?? venue.lat;
  const activeLng = venue.outdoorPoint?.lng ?? venue.lng;
  
  const baseDate = new Date(evaluatedTime);
  const { altitude: currAlt, azimuth: currAz } = getSolarCoordinates(activeLat, activeLng, baseDate);
  const inSunNow = isPointInSun(currAlt, currAz, venue.horizonMask);
  
  if (!inSunNow) return 0;
  
  let consecutiveMins = 0;
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();
  const currentHour = baseDate.getHours();
  const currentMin = baseDate.getMinutes();
  
  const startMins = currentHour * 60 + currentMin;
  const endMins = 22 * 60; // Up to end of active window (22:00)
  
  for (let mins = startMins; mins <= endMins; mins += 10) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const stepTime = new Date(year, month, day, h, m, 0);
    const { altitude, azimuth } = getSolarCoordinates(activeLat, activeLng, stepTime);
    
    if (isPointInSun(altitude, azimuth, venue.horizonMask)) {
      consecutiveMins += 10;
    } else {
      break; // Stop at first structural shade obstacle
    }
  }
  
  return consecutiveMins / 60;
}

export const HubbaMap: React.FC<HubbaMapProps> = ({
  venues,
  selectedVenue,
  onSelectVenue,
  evaluatedTime,
  isAdjustingPoint,
  onUpdateOutdoorPoint,
  userLocation,
  onBoundsChange,
  targetCenter,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const adjustmentMarkerRef = useRef<L.Marker | null>(null);
  const userLocMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [57.708878, 11.974560],
      zoom: 14,
      minZoom: 12,
      maxZoom: 18,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
    }).addTo(map);

    map.on('moveend', () => {
      onBoundsChange(map.getBounds());
    });

    setTimeout(() => {
      onBoundsChange(map.getBounds());
    }, 100);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !targetCenter) return;
    map.setView([targetCenter.lat, targetCenter.lng], targetCenter.zoom ?? 15, { animate: true });
  }, [targetCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    venues.forEach((venue) => {
      const activeLat = venue.outdoorPoint?.lat ?? venue.lat;
      const activeLng = venue.outdoorPoint?.lng ?? venue.lng;
      const { inSunNow } = calculateSunDetails(activeLat, activeLng, evaluatedTime, venue.horizonMask);

      // Calculates fill percentage based on: 4+ hrs = 100%, 2 hrs = 50%, 1 hr = 25%
      const remainingHours = getRemainingSunHours(venue, evaluatedTime);
      const fillPercent = Math.min(100, Math.round((remainingHours / 4) * 100));

      // Uses pure CSS linear gradients to render direct filling cylinder dots on active nodes
      const html = `
        <div class="flex items-center justify-center transition-transform duration-300">
          <div class="rounded-full border-2 border-white shadow-md transition-all duration-300 ${
            inSunNow 
              ? 'w-[22px] h-[22px] ring-4 ring-[#cf5a47]/10 scale-110' 
              : 'w-3 h-3 bg-[#eab88d] opacity-55'
          }" style="${inSunNow ? `background: linear-gradient(to top, #cf5a47 ${fillPercent}%, rgba(234, 184, 141, 0.3) ${fillPercent}%);` : ''}"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html,
        className: 'custom-venue-dot',
        iconSize: inSunNow ? [26, 26] : [16, 16],
        iconAnchor: inSunNow ? [13, 13] : [8, 8],
      });

      const marker = L.marker([activeLat, activeLng], { icon: customIcon })
        .addTo(map)
        .on('click', () => {
          onSelectVenue(venue);
        });

      markersRef.current[venue.id] = marker;
    });
  }, [venues, evaluatedTime]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVenue) return;
    const targetLat = selectedVenue.outdoorPoint?.lat ?? selectedVenue.lat;
    const targetLng = selectedVenue.outdoorPoint?.lng ?? selectedVenue.lng;
    map.setView([targetLat, targetLng], 16, { animate: true });
  }, [selectedVenue]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (adjustmentMarkerRef.current) {
      adjustmentMarkerRef.current.remove();
      adjustmentMarkerRef.current = null;
    }

    if (isAdjustingPoint && selectedVenue) {
      const currentLat = selectedVenue.outdoorPoint?.lat ?? selectedVenue.lat;
      const currentLng = selectedVenue.outdoorPoint?.lng ?? selectedVenue.lng;

      const adjustIcon = L.divIcon({
        html: `
          <div class="flex flex-col items-center">
            <div class="bg-[#cf5a47] text-white rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-md whitespace-nowrap mb-1">
              Drag to outdoor seating
            </div>
            <div class="w-7 h-7 rounded-full border-2 border-white bg-[#cf5a47] shadow-xl flex items-center justify-center text-white">
              📍
            </div>
          </div>
        `,
        className: 'custom-adjustment-icon',
        iconSize: [120, 60],
        iconAnchor: [60, 56],
      });

      const adjMarker = L.marker([currentLat, currentLng], {
        icon: adjustIcon,
        draggable: true,
      }).addTo(map);

      adjMarker.on('dragend', () => {
        const position = adjMarker.getLatLng();
        onUpdateOutdoorPoint(selectedVenue.id, position.lat, position.lng);
      });

      adjustmentMarkerRef.current = adjMarker;
    }
  }, [isAdjustingPoint, selectedVenue]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userLocMarkerRef.current) {
      userLocMarkerRef.current.remove();
      userLocMarkerRef.current = null;
    }

    if (userLocation) {
      const userIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-3.5 h-3.5 bg-[#7cbcc7] rounded-full border-2 border-white shadow-md"></div>
            <div class="absolute w-7 h-7 bg-[#7cbcc7] rounded-full opacity-35 animate-ping"></div>
          </div>
        `,
        className: 'user-location-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      userLocMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
    }
  }, [userLocation]);

  return <div ref={mapContainerRef} className="w-full h-full" />;
};