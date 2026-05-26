import React from 'react';
import { Venue } from '../types';
import { calculateSunDetails } from '../utils/sunUtils';

interface PlaceSheetProps {
  venue: Venue;
  evaluatedTime: Date;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isAdjustingPoint: boolean;
  onToggleAdjustMode: () => void;
  onResetOutdoorPoint: () => void;
}

export const PlaceSheet: React.FC<PlaceSheetProps> = ({
  venue,
  evaluatedTime,
  onClose,
  isFavorite,
  onToggleFavorite,
  isAdjustingPoint,
  onToggleAdjustMode,
  onResetOutdoorPoint,
}) => {
  const activeLat = venue.outdoorPoint?.lat ?? venue.lat;
  const activeLng = venue.outdoorPoint?.lng ?? venue.lng;
  const sun = calculateSunDetails(activeLat, activeLng, evaluatedTime, venue.horizonMask);

  const getDirectionsUrl = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return isIOS
      ? `maps://?q=${encodeURIComponent(venue.name)}&ll=${activeLat},${activeLng}`
      : `https://www.google.com/maps/search/?api=1&query=${activeLat},${activeLng}`;
  };

  return (
    <div className="bg-white rounded-t-3xl shadow-2xl border-t border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-50">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-slate-900 truncate">{venue.name}</h3>
          <p className="text-xs text-slate-500 truncate mt-0.5">{venue.address}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFavorite}
            className={`p-2 rounded-full border transition-colors ${
              isFavorite
                ? 'bg-rose-50 border-rose-200 text-rose-500'
                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5cc0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600">
            ✕
          </button>
        </div>
      </div>

      <div className="overflow-y-auto px-5 py-4 space-y-4">
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
          <div>
            <span className="text-xs text-slate-500 font-semibold block">SUN EXPOSURE STATUS</span>
            <span className={`text-base font-extrabold ${sun.inSunNow ? 'text-amber-600' : 'text-slate-600'}`}>
              {sun.inSunNow ? '☀️ Direct Sun (Real shadow checking)' : '🌥️ In Shadow (Real shadow checking)'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 font-semibold block">TOTAL TODAY</span>
            <span className="text-base font-extrabold text-slate-800">{(sun.totalSunMinutes / 60).toFixed(1)} hrs</span>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Calculated Sun Windows Today</h4>
          {sun.sunWindows.length === 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-xs text-slate-500">
              No direct sun exposures calculated for today.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sun.sunWindows.map((win, idx) => (
                <div key={idx} className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold">
                  {win.start} – {win.end}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
          <p className="text-xs font-bold text-amber-800 mb-0.5">☀️ V2 Real Shadow Model Active</p>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            V2 active calculations verify solar altitudes and azimuth direction vectors directly against 3D rooftop geometries imported from OpenStreetMap.
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {venue.tags.map((t) => (
            <span key={t} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
              {t}
            </span>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          <a
            href={getDirectionsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-center text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            🗺️ Open in Map Navigation
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleAdjustMode}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                isAdjustingPoint
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isAdjustingPoint ? '💾 Finish Adjusting' : '📐 Adjust Outdoor Point'}
            </button>
            {venue.outdoorPoint && (
              <button
                onClick={onResetOutdoorPoint}
                className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold border border-red-200 rounded-xl transition-colors"
                title="Reset seating adjustments"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};