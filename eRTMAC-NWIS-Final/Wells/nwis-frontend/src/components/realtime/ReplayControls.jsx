import React, { useState } from 'react';
import { Play, Square } from 'lucide-react';
import { realtimeAPI } from '../../api/client';

export default function ReplayControls({ wellId, disabled }) {
  const [speed, setSpeed] = useState(3000);
  const [loading, setLoading] = useState(false);

  const handleStart = async (selectedSpeed = speed) => {
    try {
      setLoading(true);
      await realtimeAPI.startReplay(wellId, selectedSpeed);
    } catch (err) {
      console.error('Failed to start replay:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeedChange = async (e) => {
    const newSpeed = Number(e.target.value);
    setSpeed(newSpeed);
    try {
      await realtimeAPI.startReplay(wellId, newSpeed);
    } catch (err) {
      console.error('Failed to change replay speed:', err);
    }
  };

  const handleStop = async () => {
    try {
      setLoading(true);
      await realtimeAPI.stopReplay();
    } catch (err) {
      console.error('Failed to stop replay:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '8px', 
        padding: '4px 10px', 
        background: 'var(--color-bg-card, #ffffff)', 
        borderRadius: '6px', 
        border: '1px solid var(--color-border, #e2e8f0)' 
      }}
    >
      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #64748b)', fontWeight: 600, letterSpacing: '0.04em' }}>
        REPLAY
      </span>

      {/* Minimal Speed Dropdown (1x, 2x, 4x) */}
      <select
        value={speed}
        onChange={handleSpeedChange}
        disabled={disabled || loading}
        className="input select"
        style={{
          padding: '4px 8px',
          fontSize: '0.8rem',
          height: '30px',
          width: 'auto',
          minWidth: '78px',
          borderRadius: '5px',
          border: '1px solid var(--color-border, #cbd5e1)',
          background: 'var(--color-bg-primary, #f8fafc)',
          color: 'var(--color-text-primary, #0f172a)',
          cursor: 'pointer',
          fontWeight: 600
        }}
        title="Select replay speed"
        aria-label="Replay speed"
      >
        <option value={3000}>1x</option>
        <option value={1500}>2x</option>
        <option value={750}>4x</option>
      </select>

      {/* Minimal Start Button */}
      <button 
        type="button"
        onClick={() => handleStart(speed)} 
        disabled={disabled || loading}
        className="btn btn-sm btn-secondary"
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '5px',
          height: '30px',
          padding: '0 10px',
          fontSize: '0.78rem',
          fontWeight: 600,
          background: 'var(--color-bg-primary, #f8fafc)',
          border: '1px solid var(--color-border, #cbd5e1)',
          color: 'var(--color-text-primary, #0f172a)'
        }}
        title="Start replay at selected speed"
      >
        <Play size={12} style={{ fill: 'currentColor' }} /> Start
      </button>

      <div style={{ width: '1px', height: '16px', background: 'var(--color-border, #cbd5e1)', margin: '0 2px' }} />

      {/* Minimal Stop Button */}
      <button 
        type="button"
        onClick={handleStop} 
        disabled={disabled || loading}
        className="btn btn-sm btn-secondary"
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '5px',
          height: '30px',
          padding: '0 10px',
          fontSize: '0.78rem',
          fontWeight: 600,
          background: 'var(--color-bg-primary, #f8fafc)',
          border: '1px solid var(--color-border, #cbd5e1)',
          color: 'var(--color-text-secondary, #64748b)'
        }}
        title="Stop replay"
      >
        <Square size={11} style={{ fill: 'currentColor' }} /> Stop
      </button>
    </div>
  );
}
