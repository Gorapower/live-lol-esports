import React from "react";
import { useBackfill } from "./BackfillContext";

export function BackfillTest() {
  const { backfillState, setBackfillState, isBackfillEnabled } = useBackfill();

  return (
    <div style={{ 
      padding: '10px', 
      margin: '10px', 
      border: '1px solid var(--border-color)', 
      borderRadius: '5px',
      backgroundColor: 'var(--card-color)',
      color: 'var(--text-color)'
    }}>
      <h3>Backfill Toggle Test</h3>
      <p>Current backfill state: <strong>{backfillState}</strong></p>
      <p>Is backfill enabled: <strong>{isBackfillEnabled ? 'Yes' : 'No'}</strong></p>
      <button onClick={() => setBackfillState('enabled')}>
        Enable Backfill
      </button>
      <button onClick={() => setBackfillState('disabled')}>
        Disable Backfill
      </button>
      <button onClick={() => setBackfillState(prev => prev === 'enabled' ? 'disabled' : 'enabled')}>
        Toggle Backfill
      </button>
    </div>
  );
}