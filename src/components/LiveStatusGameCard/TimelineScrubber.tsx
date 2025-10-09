import React from "react";
import "./styles/playerStatusStyle.css";
import "./styles/timelineScrubber.css";

interface TimelineScrubberProps {
  timestamps: number[];
  value: number | null; // epoch millis or null for live
  onChange: (epoch: number) => void;
  onLive: () => void;
  disabled: boolean;
  isBackfilling: boolean;
}

export function TimelineScrubber({
  timestamps,
  value,
  onChange,
  onLive,
  disabled,
  isBackfilling,
}: TimelineScrubberProps) {
  if (timestamps.length === 0) {
    return null;
  }

  // Convert epoch millis to minutes:seconds format
  const formatTime = (epoch: number) => {
    const firstTimestamp = timestamps[0];
    const seconds = Math.floor((epoch - firstTimestamp) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Find the index of the current value
  const getCurrentIndex = () => {
    if (value === null) return timestamps.length - 1; // Live position
    const index = timestamps.findIndex(ts => ts === value);
    return index >= 0 ? index : timestamps.length - 1;
  };

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    onChange(timestamps[index]);
  };

  const currentIndex = getCurrentIndex();
  const minTime = timestamps[0];
  const maxTime = timestamps[timestamps.length - 1];
  const currentTime = value !== null ? value : maxTime;

  return (
    <div className="timeline-scrubber">
      <div className="timeline-controls">
        <button
          className={`timeline-live-button ${value === null ? "active" : ""}`}
          onClick={onLive}
          disabled={disabled}
        >
          LIVE
        </button>
        
        {isBackfilling && (
          <span className="timeline-status">Loading match history...</span>
        )}
      </div>

      <div className="timeline-slider-container">
        <span className="timeline-time">{formatTime(minTime)}</span>
        
        <input
          type="range"
          min="0"
          max={timestamps.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          disabled={disabled}
          className="timeline-slider"
        />
        
        <span className="timeline-time">
          {value === null ? "LIVE" : formatTime(currentTime)}
        </span>
      </div>
    </div>
  );
}