import React from 'react';
import './FormationTrack.css';
import { formatDepth } from '../../utils/formatters';
import { ChevronRight, Layers } from 'lucide-react';

const FormationTrack = ({ 
  formations = [], 
  currentDepth,
  selectedFormation,
  onSelectFormation
}) => {
  if (!formations || formations.length === 0) return <div className="formation-track empty">No formation data</div>;

  const minDepth = Math.min(...formations.map(f => f.top_depth));
  const maxDepth = Math.max(...formations.map(f => f.bottom_depth));
  const totalRange = maxDepth - minDepth || 1000;

  const getPercentage = (depth) => {
    return ((depth - minDepth) / totalRange) * 100;
  };

  const isCurrentFormation = (f) => {
    if (!currentDepth) return false;
    return currentDepth >= f.top_depth && currentDepth <= f.bottom_depth;
  };

  const isSelected = (f) => {
    if (!selectedFormation) return false;
    const sId = selectedFormation.formation_id || selectedFormation.id;
    const fId = f.formation_id || f.id;
    if (sId && fId && sId === fId) return true;
    const sName = selectedFormation.formation_name || selectedFormation.name;
    const fName = f.formation_name || f.name;
    return sName && fName && sName.toLowerCase() === fName.toLowerCase();
  };

  return (
    <div className="formation-track-container">
      <div className="formation-track-hint">
        <Layers size={14} style={{ color: 'var(--color-sidebar-bg, #95562d)' }} />
        <span>Click any formation block to inspect historical events, offset wells & subsurface hazards</span>
      </div>

      <div className="formation-track">
        {formations.map((form, index) => {
          const topPercent = getPercentage(form.top_depth);
          const heightPercent = getPercentage(form.bottom_depth) - topPercent;
          const isCurrent = isCurrentFormation(form);
          const selected = isSelected(form);
          const name = form.formation_name || form.name || `Formation ${index + 1}`;
          const lith = form.lithology || form.geological_attributes?.lithology || form.description || 'Sedimentary formation';

          return (
            <div 
              key={form.id || form.formation_id || index}
              className={`formation-block ${isCurrent ? 'current' : ''} ${selected ? 'selected' : ''}`}
              style={{
                top: `${topPercent}%`,
                height: `${heightPercent}%`,
                cursor: onSelectFormation ? 'pointer' : 'default'
              }}
              onClick={() => onSelectFormation && onSelectFormation(form)}
              role={onSelectFormation ? 'button' : undefined}
              tabIndex={onSelectFormation ? 0 : undefined}
              onKeyDown={(e) => {
                if (onSelectFormation && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelectFormation(form);
                }
              }}
              title="Click to view formation events, risks & offset wells"
            >
              <div className="formation-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="formation-name">{name}</span>
                  {selected && (
                    <span className="formation-selected-pill">Active</span>
                  )}
                </div>
                <span className="formation-lithology">{lith}</span>
              </div>
              <div className="formation-depths">
                <div className="depth-marker top">{formatDepth(form.top_depth)}</div>
                <div className="depth-marker bottom">{formatDepth(form.bottom_depth)}</div>
              </div>
              {onSelectFormation && (
                <div className="formation-click-icon" title="View details">
                  <ChevronRight size={14} />
                </div>
              )}
            </div>
          );
        })}

        {currentDepth && currentDepth >= minDepth && currentDepth <= maxDepth && (
          <div 
            className="current-depth-indicator"
            style={{ top: `${getPercentage(currentDepth)}%` }}
          >
            <div className="current-depth-line"></div>
            <div className="current-depth-label">CURRENT DEPTH: {formatDepth(currentDepth)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormationTrack;
