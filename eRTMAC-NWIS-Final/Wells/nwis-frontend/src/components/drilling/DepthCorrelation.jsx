import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, ArrowUpDown } from 'lucide-react';

export default function DepthCorrelation({ 
  activeWellFormations = [], 
  offsetWellFormations = [], 
  historicalEvents = [], 
  currentDepth, 
  maxDepth = 5000 
}) {
  const [alignByFormationTop, setAlignByFormationTop] = useState(false);
  const [selectedFormation, setSelectedFormation] = useState('Kopili Formation');

  // Identify active formation top
  const activeFormation = useMemo(() => {
    return activeWellFormations.find(f => 
      f.name?.toLowerCase().includes(selectedFormation.toLowerCase().replace(' formation', ''))
    ) || activeWellFormations.find(f => f.name?.toLowerCase().includes('kopili')) || activeWellFormations[0];
  }, [activeWellFormations, selectedFormation]);

  const offsetFormation = useMemo(() => {
    return offsetWellFormations.find(f => 
      f.name?.toLowerCase().includes(selectedFormation.toLowerCase().replace(' formation', ''))
    ) || offsetWellFormations.find(f => f.name?.toLowerCase().includes('kopili')) || offsetWellFormations[0];
  }, [offsetWellFormations, selectedFormation]);

  const activeTop = activeFormation ? parseFloat(activeFormation.top_depth) : 0;
  const offsetTop = offsetFormation ? parseFloat(offsetFormation.top_depth) : 0;

  // Relative window: -200m above top to +800m below top (1000m total window)
  const RELATIVE_WINDOW = 1000;
  const RELATIVE_OFFSET = 200; // top is at 20% of container height

  // Scale calculations
  const getTopPercent = (depth, isOffset = false) => {
    if (!alignByFormationTop) {
      return Math.max(0, Math.min(100, (depth / maxDepth) * 100));
    }
    const topRef = isOffset ? offsetTop : activeTop;
    const relDepth = depth - topRef; // e.g. -200 to +800
    const percent = ((relDepth + RELATIVE_OFFSET) / RELATIVE_WINDOW) * 100;
    return Math.max(0, Math.min(100, percent));
  };

  const getHeightPercent = (startDepth, endDepth, isOffset = false) => {
    if (!alignByFormationTop) {
      const start = Math.max(0, (startDepth / maxDepth) * 100);
      const end = Math.min(100, (endDepth / maxDepth) * 100);
      return Math.max(0, end - start);
    }
    const topRef = isOffset ? offsetTop : activeTop;
    const relStart = startDepth - topRef;
    const relEnd = endDepth - topRef;
    const startPct = ((relStart + RELATIVE_OFFSET) / RELATIVE_WINDOW) * 100;
    const endPct = ((relEnd + RELATIVE_OFFSET) / RELATIVE_WINDOW) * 100;
    return Math.max(0, Math.min(100, endPct) - Math.max(0, startPct));
  };

  const renderFormation = (f, isOffset = false) => {
    const top = getTopPercent(f.top_depth, isOffset);
    const height = getHeightPercent(f.top_depth, f.bottom_depth, isOffset);
    const isTargetFormation = f.name?.toLowerCase().includes('kopili');

    return (
      <div 
        key={`${f.name}-${f.top_depth}-${isOffset}`}
        style={{
          position: 'absolute',
          top: `${top}%`,
          height: `${height}%`,
          width: '100%',
          background: isTargetFormation
            ? (isOffset ? 'rgba(56, 189, 248, 0.22)' : 'rgba(52, 211, 153, 0.22)')
            : (isOffset ? 'rgba(56, 189, 248, 0.08)' : 'rgba(52, 211, 153, 0.08)'),
          borderTop: `1px solid ${isTargetFormation ? '#38bdf8' : (isOffset ? 'rgba(56, 189, 248, 0.5)' : 'rgba(52, 211, 153, 0.5)')}`,
          borderBottom: `1px solid ${isTargetFormation ? '#38bdf8' : (isOffset ? 'rgba(56, 189, 248, 0.5)' : 'rgba(52, 211, 153, 0.5)')}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transition: 'all 0.4s ease'
        }}
      >
        <span style={{ 
          fontSize: '0.72rem', 
          color: isTargetFormation ? '#fff' : (isOffset ? '#38bdf8' : '#34d399'), 
          fontWeight: isTargetFormation ? 700 : 500,
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          padding: '4px'
        }}>
          {f.name} ({f.top_depth}m)
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: '620px', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
      
      {/* Correlation Toolbar */}
      <div style={{ padding: '8px 16px', background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={14} className="text-primary" />
          <span style={{ fontWeight: 600 }}>Stratigraphic Correlation View</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {alignByFormationTop && (
            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
              ✓ Aligned by {selectedFormation} Top
            </span>
          )}
          <button
            type="button"
            className={`btn btn-xs ${alignByFormationTop ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAlignByFormationTop(!alignByFormationTop)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', fontSize: '0.72rem' }}
          >
            <ArrowUpDown size={12} />
            {alignByFormationTop ? 'Align by Absolute MD' : 'Align by Formation Top'}
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Active Well Formations Track */}
        <div style={{ flex: 1, position: 'relative', borderRight: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ padding: '6px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--color-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            Active Well {activeFormation && alignByFormationTop && `(Top: ${activeTop}m)`}
          </div>
          <div style={{ position: 'absolute', top: 32, bottom: 0, left: 0, right: 0 }}>
            {activeWellFormations.map(f => renderFormation(f, false))}
          </div>
        </div>

        {/* Central Correlation Axis & Events */}
        <div style={{ width: '90px', position: 'relative', background: 'rgba(0,0,0,0.25)', borderRight: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ padding: '6px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--color-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {alignByFormationTop ? 'Rel. Top (m)' : 'MD (m)'}
          </div>
          <div style={{ position: 'absolute', top: 32, bottom: 0, left: 0, right: 0 }}>
            {/* Ticks */}
            {!alignByFormationTop ? (
              [...Array(11)].map((_, i) => {
                const depth = (maxDepth / 10) * i;
                return (
                  <div key={i} style={{ position: 'absolute', top: `${(i/10)*100}%`, width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ position: 'absolute', top: '-8px', left: '4px', fontSize: '0.65rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{depth}</span>
                  </div>
                );
              })
            ) : (
              // Relative ticks: -200, 0 (Datum), 200, 400, 600, 800
              [-200, -100, 0, 100, 200, 300, 400, 500, 600, 700, 800].map((rel) => {
                const pct = ((rel + RELATIVE_OFFSET) / RELATIVE_WINDOW) * 100;
                const isDatum = rel === 0;
                return (
                  <div 
                    key={rel} 
                    style={{ 
                      position: 'absolute', 
                      top: `${pct}%`, 
                      width: '100%', 
                      borderTop: isDatum ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      zIndex: isDatum ? 15 : 1
                    }}
                  >
                    <span style={{ 
                      position: 'absolute', 
                      top: '-8px', 
                      left: '4px', 
                      fontSize: '0.65rem', 
                      color: isDatum ? '#10b981' : 'var(--color-text-secondary)', 
                      fontWeight: isDatum ? 700 : 400,
                      fontFamily: 'var(--font-mono)' 
                    }}>
                      {isDatum ? 'DATUM 0m' : `${rel > 0 ? `+${rel}` : rel}m`}
                    </span>
                  </div>
                );
              })
            )}

            {/* Historical Events Placed on the Correlation Track */}
            {historicalEvents.map((ev, i) => {
              const topPct = getTopPercent(parseFloat(ev.depth), true);
              return (
                <div 
                  key={i}
                  title={`${ev.event_type} at ${ev.depth}m in ${ev.well_name || 'offset well'}`}
                  style={{
                    position: 'absolute',
                    top: `${topPct}%`,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: ev.severity === 'high' ? '#f87171' : (ev.severity === 'medium' ? '#fbbf24' : '#38bdf8'),
                    border: '2px solid #0f172a',
                    zIndex: 20,
                    boxShadow: '0 0 6px rgba(0,0,0,0.5)'
                  }}
                />
              );
            })}

            {/* Current Active Well Depth Marker */}
            {currentDepth !== undefined && (
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ yoyo: Infinity, duration: 1 }}
                style={{
                  position: 'absolute',
                  top: `${getTopPercent(currentDepth, false)}%`,
                  width: '100%',
                  height: '2px',
                  background: '#ef4444',
                  zIndex: 25
                }}
              >
                <div style={{ position: 'absolute', right: '100%', top: '-8px', background: '#ef4444', color: '#fff', fontSize: '0.68rem', padding: '1px 4px', borderRadius: '3px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {currentDepth}m
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Offset Well Formations Track */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ padding: '6px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--color-text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            Offset Well {offsetFormation && alignByFormationTop && `(Top: ${offsetTop}m)`}
          </div>
          <div style={{ position: 'absolute', top: 32, bottom: 0, left: 0, right: 0 }}>
            {offsetWellFormations.map(f => renderFormation(f, true))}
          </div>
        </div>
      </div>
    </div>
  );
}
