import React, { useEffect, useRef, useState } from 'react';
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
  const endMins = 22 * 60;
  
  for (let mins = startMins; mins <= endMins; mins += 10) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const stepTime = new Date(year, month, day, h, m, 0);
    const { altitude, azimuth } = getSolarCoordinates(activeLat, activeLng, stepTime);
    
    if (isPointInSun(altitude, azimuth, venue.horizonMask)) {
      consecutiveMins += 10;
    } else {
      break;
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
  const markersRef = useRef<{ [key: string]: L.Marker | L.Layer }>({});
  const adjustmentMarkerRef = useRef<L.Marker | null>(null);
  const userLocMarkerRef = useRef<L.Marker | null>(null);

  const [zoomState, setZoomState] = useState(14);

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

    map.on('zoomend', () => {
      setZoomState(map.getZoom());
    });

    setTimeout(() => {
      onBoundsChange(map.getBounds());
      setZoomState(map.getZoom());
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

    Object.values(markersRef.current).forEach((layer) => layer.remove());
    markersRef.current = {};

    if (zoomState <= 13) {
      const clusters: { [key: string]: Venue[] } = {};
      const gridSize = zoomState === 13 ? 0.007 : zoomState === 12 ? 0.014 : 0.028;

      venues.forEach((venue) => {
        const lat = venue.outdoorPoint?.lat ?? venue.lat;
        const lng = venue.outdoorPoint?.lng ?? venue.lng;
        const cellX = Math.floor(lng / gridSize);
        const cellY = Math.floor(lat / gridSize);
        const key = `${cellX}_${cellY}`;
        
        if (!clusters[key]) {
          clusters[key] = [];
        }
        clusters[key].push(venue);
      });

      Object.entries(clusters).forEach(([key, list]) => {
        if (list.length === 1) {
          renderIndividualMarker(map, list[0], false);
        } else {
          let sumLat = 0;
          let sumLng = 0;
          list.forEach(v => {
            sumLat += v.outdoorPoint?.lat ?? v.lat;
            sumLng += v.outdoorPoint?.lng ?? v.lng;
          });
          const avgLat = sumLat / list.length;
          const avgLng = sumLng / list.length;

          const anyInSun = list.some(v => {
            const activeLat = v.outdoorPoint?.lat ?? v.lat;
            const activeLng = v.outdoorPoint?.lng ?? v.lng;
            const { inSunNow } = calculateSunDetails(activeLat, activeLng, evaluatedTime, v.horizonMask);
            return inSunNow;
          });

          // Clusters use 4th priority Deep Burgundy (#350505) and Main Red (#fc5a47) indicators
          const html = `
            <div class="flex items-center justify-center w-11 h-11 relative">
              <div class="absolute inset-0"></div>
              <div class="w-8 h-8 bg-[#350505] text-[#eebd8d] rounded-full flex items-center justify-center text-xs font-bold shadow-md border-2 border-white relative transition-transform ${
                anyInSun ? 'ring-4 ring-[#fc5a47]/30' : ''
              }">
                ${list.length}
                ${anyInSun ? `<div class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#fc5a47] rounded-full border border-white shadow-sm"></div>` : ''}
              </div>
            </div>
          `;

          const customIcon = L.divIcon({
            html,
            className: 'custom-cluster-icon',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });

          const clusterMarker = L.marker([avgLat, avgLng], { icon: customIcon, zIndexOffset: 2000 })
            .addTo(map)
            .on('click', () => {
              map.setView([avgLat, avgLng], zoomState + 2, { animate: true });
            });

          markersRef.current[`cluster-${key}`] = clusterMarker;
        }
      });
    } else {
      venues.forEach((venue) => {
        renderIndividualMarker(map, venue, zoomState >= 15);
      });
    }
  }, [venues, evaluatedTime, zoomState]);

  const renderIndividualMarker = (map: L.Map, venue: Venue, showBadge: boolean) => {
    const activeLat = venue.outdoorPoint?.lat ?? venue.lat;
    const activeLng = venue.outdoorPoint?.lng ?? venue.lng;
    const { inSunNow, totalSunMinutes } = calculateSunDetails(activeLat, activeLng, evaluatedTime, venue.horizonMask);

    const remainingHours = getRemainingSunHours(venue, evaluatedTime);
    const fillPercent = Math.min(100, Math.round((remainingHours / 4) * 100));

    const roundedHours = Math.round(totalSunMinutes / 60);
    const badgeText = roundedHours >= 6 ? '6h+' : `${roundedHours}h`;

    // Direct sun uses Main (#fc5a47) as a cylinder fill
    // Inactive shaded dots use a clean, semi-translucent soft Beige (#eebd8d)
    const html = `
      <div class="flex items-center justify-center w-11 h-11 relative">
        <div class="absolute inset-0"></div>
        
        <div class="rounded-full border-2 border-white shadow-md transition-all duration-300 ${
          inSunNow 
            ? 'w-5 h-5 ring-4 ring-[#fc5a47]/10 scale-110' 
            : 'w-3.5 h-3.5 bg-[#eebd8d] opacity-55'
        }" style="${inSunNow ? `background: linear-gradient(to top, #fc5a47 ${fillPercent}%, rgba(238, 189, 141, 0.3) ${fillPercent}%);` : ''}"></div>

        ${showBadge ? `
          <div class="absolute left-7 bg-[#faf8f5]/95 px-1.5 py-0.5 rounded-md border border-[#eebd8d]/30 shadow-sm text-[9px] font-extrabold whitespace-nowrap text-[#350505] tracking-tight">
            ${badgeText}
          </div>
        ` : ''}
      </div>
    `;

    const customIcon = L.divIcon({
      html,
      className: 'custom-venue-dot',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const marker = L.marker([activeLat, activeLng], { 
      icon: customIcon,
      zIndexOffset: inSunNow ? 1000 : 0
    })
      .addTo(map)
      .on('click', () => {
        onSelectVenue(venue);
      });

    markersRef.current[venue.id] = marker;
  };

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
            <div class="bg-[#fc5a47] text-white rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-md whitespace-nowrap mb-1">
              Drag to outdoor seating
            </div>
            <div class="w-7 h-7 rounded-full border-2 border-white bg-[#fc5a47] shadow-xl flex items-center justify-center text-white">
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

  // Geolocation uses Secondary/Teal (#7cbec7)
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
            <div class="w-3.5 h-3.5 bg-[#7cbec7] rounded-full border-2 border-white shadow-md"></div>
            <div class="absolute w-7 h-7 bg-[#7cbec7] rounded-full opacity-35 animate-ping"></div>
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