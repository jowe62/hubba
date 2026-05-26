import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Venue } from '../types';
import { calculateSunDetails } from '../utils/sunUtils';

interface HubbaMapProps {
  venues: Venue[];
  selectedVenue: Venue | null;
  onSelectVenue: (venue: Venue) => void;
  evaluatedTime: Date;
  isAdjustingPoint: boolean;
  onUpdateOutdoorPoint: (id: string, lat: number, lng: number) => void;
  userLocation: { lat: number; lng: number } | null;
  onBoundsChange: (bounds: L.LatLngBounds) => void;
  targetCenter: { lat: number; lng: number; zoom?: number } | null; // Added in V3
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

  // Initialize Map
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

  // Fly-to listener for district chips jumping
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !targetCenter) return;
    map.setView([targetCenter.lat, targetCenter.lng], targetCenter.zoom ?? 15, { animate: true });
  }, [targetCenter]);

  // Update/Draw Venue Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    venues.forEach((venue) => {
      const activeLat = venue.outdoorPoint?.lat ?? venue.lat;
      const activeLng = venue.outdoorPoint?.lng ?? venue.lng;
      const { inSunNow } = calculateSunDetails(activeLat, activeLng, evaluatedTime, venue.horizonMask);

      const html = `
        <div class="flex items-center justify-center transition-all duration-300">
          <div class="relative flex items-center justify-center ${
            inSunNow 
              ? 'w-9 h-9 bg-amber-400 text-slate-900 border-2 border-white rounded-full shadow-lg ring-4 ring-amber-400/30' 
              : 'w-7 h-7 bg-slate-400 text-white border border-white rounded-full opacity-70 shadow'
          }">
            <svg class="${inSunNow ? 'w-5 h-5 animate-pulse' : 'w-4 h-4'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path>
            </svg>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html,
        className: 'custom-venue-icon',
        iconSize: inSunNow ? [36, 36] : [28, 28],
        iconAnchor: inSunNow ? [18, 18] : [14, 14],
      });

      const marker = L.marker([activeLat, activeLng], { icon: customIcon })
        .addTo(map)
        .on('click', () => {
          onSelectVenue(venue);
        });

      markersRef.current[venue.id] = marker;
    });
  }, [venues, evaluatedTime]);

  // Handle Selected Venue camera panning
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedVenue) return;
    const targetLat = selectedVenue.outdoorPoint?.lat ?? selectedVenue.lat;
    const targetLng = selectedVenue.outdoorPoint?.lng ?? selectedVenue.lng;
    map.setView([targetLat, targetLng], 16, { animate: true });
  }, [selectedVenue]);

  // Adjusting Seating Point (Drag and Drop Marker interface)
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
            <div class="bg-indigo-600 text-white rounded-lg px-2 py-1 text-xs font-semibold shadow-md whitespace-nowrap mb-1">
              Drag to outdoor seating
            </div>
            <div class="w-8 h-8 rounded-full border-2 border-white bg-indigo-500 shadow-xl flex items-center justify-center text-white">
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

  // User Live Geolocation Marker
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
            <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>
            <div class="absolute w-8 h-8 bg-blue-400 rounded-full opacity-30 animate-ping"></div>
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