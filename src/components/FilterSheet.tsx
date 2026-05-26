import React from 'react';

interface FilterSheetProps {
  onClose: () => void;
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  hoursThreshold: number;
  onHoursChange: (hours: number) => void;
  onlyFavorites: boolean;
  onToggleFavorites: () => void;
  onClear: () => void;
}

export const FilterSheet: React.FC<FilterSheetProps> = ({
  onClose,
  availableTags,
  selectedTags,
  onToggleTag,
  hoursThreshold,
  onHoursChange,
  onlyFavorites,
  onToggleFavorites,
  onClear,
}) => {
  return (
    <div className="bg-white rounded-t-3xl shadow-2xl border-t border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-800">Advanced Filters</h3>
        <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600">
          ✕
        </button>
      </div>

      <div className="overflow-y-auto px-5 py-4 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-slate-800">Favorites Only</span>
            <p className="text-xs text-slate-400">Show only marked favorites</p>
          </div>
          <input
            type="checkbox"
            checked={onlyFavorites}
            onChange={onToggleFavorites}
            className="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
          />
        </div>

        <div>
          <span className="text-sm font-bold text-slate-800 block mb-2">Minimum Exposure Duration Today</span>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((hr) => (
              <button
                key={hr}
                onClick={() => onHoursChange(hr)}
                className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                  hoursThreshold === hr
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ≥ {hr} hr{hr > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm font-bold text-slate-800 block mb-2">Categories / Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map((t) => {
              const isSelected = selectedTags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => onToggleTag(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 flex gap-2">
          <button
            onClick={onClear}
            className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold"
          >
            Reset Filters
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};
