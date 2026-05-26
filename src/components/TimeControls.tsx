import React from 'react';

interface TimeControlsProps {
  currentHour: number;
  currentMin: number;
  onTimeChange: (hour: number, minute: number) => void;
  isLiveNow: boolean;
  onSetLiveNow: () => void;
}

export const TimeControls: React.FC<TimeControlsProps> = ({
  currentHour,
  currentMin,
  onTimeChange,
  isLiveNow,
  onSetLiveNow,
}) => {
  const sliderVal = currentHour * 60 + currentMin;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const totalMinutes = parseInt(e.target.value, 10);
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor((totalMinutes % 60) / 10) * 10;
    onTimeChange(h, m);
  };

  const formatDisplayTime = (h: number, m: number) => {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const presets = [
    { label: 'Lunch', h: 12, m: 0 },
    { label: 'AW (17)', h: 17, m: 0 },
    { label: 'Evening', h: 20, m: 0 },
  ];

  return (
    <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-500">Selected Time</span>
        <div className="flex items-center gap-2">
          {isLiveNow && (
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          )}
          <span className="text-2xl font-bold tracking-tight text-slate-800 tabular-nums">
            {formatDisplayTime(currentHour, currentMin)}
          </span>
        </div>
      </div>

      <div className="relative w-full">
        <input
          type="range"
          min={8 * 60}
          max={22 * 60}
          step={10}
          value={sliderVal}
          onChange={handleSliderChange}
          className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
        />
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium px-1">
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>22:00</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-1">
        <button
          onClick={onSetLiveNow}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
            isLiveNow
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          📍 Now
        </button>
        {presets.map((preset) => {
          const isActive = !isLiveNow && currentHour === preset.h && currentMin === preset.m;
          return (
            <button
              key={preset.label}
              onClick={() => onTimeChange(preset.h, preset.m)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
                isActive
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
