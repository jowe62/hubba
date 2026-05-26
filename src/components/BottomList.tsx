import React, { useState } from 'react';
import { Venue } from '../types';
import { calculateSunDetails } from '../utils/sunUtils';

interface BottomListProps {
  venuesInView: Venue[];
  totalVenuesCount: number;
  evaluatedTime: Date;
  onSelectVenue: (venue: Venue) => void;
  onClearFilters?: () => void;
  hasActiveFilters: boolean;
}

export const BottomList: React.FC<BottomListProps> = ({
  venuesInView,
  totalVenuesCount,
  evaluatedTime,
  onSelectVenue,
  onClearFilters,
  hasActiveFilters,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const processed = venuesInView
    .map((v) => {
      const activeLat = v.outdoorPoint?.lat ?? v.lat;
      const activeLng = v.outdoorPoint?.lng ?? v.lng;
      const sun = calculateSunDetails(activeLat, activeLng, evaluatedTime);
      return { venue: v, sun };
    })
    .sort((a, b) => {
      if (a.sun.inSunNow && !b.sun.inSunNow) return -1;
      if (!a.sun.inSunNow && b.sun.inSunNow) return 1;
      return b.sun.totalSunMinutes - a.sun.totalSunMinutes;
    })
    .slice(0, 8);

  return (
    <div className="bg-white rounded-t-3xl shadow-2xl border-t border-slate-100 transition-all duration-300 flex flex-col max-h-[75vh]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-3 flex flex-col items-center justify-center focus:outline-none"
      >
        <div className="w-12 h-1 bg-slate-200 rounded-full mb-2"></div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800">
            {isOpen ? 'Collapse list' : `Show venues nearby (${venuesInView.length})`}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="overflow-y-auto px-4 pb-6 flex-1 divide-y divide-slate-100">
          {processed.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center">
              <span className="text-3xl mb-2">🤷‍♂️</span>
              <p className="text-sm font-bold text-slate-700">No matching venues here</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                Pan/zoom the map or modify your dynamic dashboard filters.
              </p>
              {hasActiveFilters && onClearFilters && (
                <button
                  onClick={onClearFilters}
                  className="mt-3 px-4 py-2 bg-slate-950 text-white rounded-full text-xs font-semibold"
                >
                  Clear Active Filters
                </button>
              )}
            </div>
          ) : (
            processed.map(({ venue, sun }) => (
              <div
                key={venue.id}
                onClick={() => {
                  onSelectVenue(venue);
                  setIsOpen(false);
                }}
                className="py-3 flex items-center justify-between cursor-pointer active:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{venue.name}</h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {venue.tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right flex-shrink-0 flex flex-col items-end">
                  {sun.inSunNow ? (
                    <span className="text-xs font-extrabold text-amber-600 flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      ☀️ Sun now
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                      Shadow now
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-slate-500 mt-1">
                    Total today: {(sun.totalSunMinutes / 60).toFixed(1)}h
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
