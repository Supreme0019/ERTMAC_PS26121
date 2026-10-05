import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '../ui/Drawer';
import { formationsAPI, eventsAPI } from '../../api/client';
import { formatDepth, formatEventType } from '../../utils/formatters';
import { 
  Layers, AlertTriangle, ShieldAlert, ExternalLink, 
  MapPin, Info, ArrowUpRight, Activity, CheckCircle2 
} from 'lucide-react';

export default function FormationDetailDrawer({
  formation,
  isOpen,
  onClose,
  currentDepth,
  wellEvents = [],
  wellRisks = [],
  similarWells = []
}) {
  const navigate = useNavigate();
  const formationId = formation?.formation_id || formation?.id;
  const formationName = formation?.formation_name || formation?.name || 'Formation';

  // 1. Fetch full formation metadata if available
  const { data: formationDetailsRes } = useQuery({
    queryKey: ['formation-detail', formationId],
    queryFn: () => formationsAPI.getById(formationId).then(r => r.data?.data?.formation || r.data?.formation || r.data),
    enabled: !!formationId && !!isOpen
  });

  // 2. Fetch all other wells penetrating this formation
  const { data: penetratingWellsRes, isLoading: loadingWells } = useQuery({
    queryKey: ['formation-wells', formationId],
    queryFn: () => formationsAPI.getWells(formationId).then(r => r.data?.data?.wells || r.data?.wells || []),
    enabled: !!formationId && !!isOpen
  });

  if (!formation) return null;

  const fullFormation = formationDetailsRes || formation;
  const lithology = fullFormation.lithology || 
    fullFormation.geological_attributes?.lithology || 
    fullFormation.description || 
    'Lithological data logged';
  
  const thickness = (formation.bottom_depth != null && formation.top_depth != null)
    ? Math.max(0, formation.bottom_depth - formation.top_depth)
    : null;

  const isCurrent = currentDepth != null && 
    currentDepth >= formation.top_depth && 
    currentDepth <= formation.bottom_depth;

  // Filter events in this formation
  const formationEvents = (wellEvents || []).filter(e => {
    if (e.formation && e.formation.toLowerCase() === formationName.toLowerCase()) return true;
    if (e.depth != null && formation.top_depth != null && formation.bottom_depth != null) {
      return e.depth >= formation.top_depth && e.depth <= formation.bottom_depth;
    }
    return false;
  });

  // Filter risks in this formation interval
  const formationRisks = (wellRisks || []).filter(r => {
    const depth = r.depth_m || r.depth || (r.depth_range ? (r.depth_range[0] + r.depth_range[1]) / 2 : null);
    if (depth != null && formation.top_depth != null && formation.bottom_depth != null) {
      if (depth >= formation.top_depth && depth <= formation.bottom_depth) return true;
    }
    if (r.reasons && r.reasons.some(reason => reason.toLowerCase().includes(formationName.toLowerCase()))) return true;
    return false;
  });

  // Wells penetrating this formation
  const penetratingWells = Array.isArray(penetratingWellsRes) ? penetratingWellsRes : [];

  const getSeverityBadge = (severity) => {
    const s = severity?.toLowerCase();
    if (s === 'critical') return { bg: '#FEE2E2', color: '#DC2626', border: '#FCA5A5' };
    if (s === 'high') return { bg: '#FEF3C7', color: '#D97706', border: '#FCD34D' };
    if (s === 'moderate' || s === 'medium') return { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' };
    return { bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' };
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Formation Intelligence & Stratigraphy"
      width={460}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Formation Header Card */}
        <div style={{
          backgroundColor: '#FFF8ED',
          border: '1px solid #F0DCC0',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Layers size={18} style={{ color: 'var(--color-sidebar-bg, #95562d)' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1A1410' }}>
                  {formationName}
                </h3>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                Lithology: <strong style={{ color: '#374151' }}>{lithology}</strong>
              </div>
            </div>

            {isCurrent && (
              <span style={{
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap'
              }}>
                CURRENT BIT DEPTH
              </span>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid #E8DCC8'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#78716C', textTransform: 'uppercase', display: 'block' }}>Top Depth</span>
              <strong style={{ fontSize: '0.92rem', color: '#1A1410' }}>{formatDepth(formation.top_depth)}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#78716C', textTransform: 'uppercase', display: 'block' }}>Base Depth</span>
              <strong style={{ fontSize: '0.92rem', color: '#1A1410' }}>{formatDepth(formation.bottom_depth)}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#78716C', textTransform: 'uppercase', display: 'block' }}>Interval</span>
              <strong style={{ fontSize: '0.92rem', color: '#1A1410' }}>{thickness != null ? `${thickness} m` : '—'}</strong>
            </div>
          </div>
        </div>

        {/* Geological Overview / Notes */}
        {fullFormation.description && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '6px',
            backgroundColor: '#F7F3EC',
            border: '1px solid #E8DCC8',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            color: '#374151'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontWeight: 600, color: '#1A1410' }}>
              <Info size={14} style={{ color: '#D97706' }} /> Geological Overview
            </div>
            {fullFormation.description}
          </div>
        )}

        {/* Historical Subsurface Events in Formation */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1A1410', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={15} style={{ color: '#EF4444' }} /> Historical Events in Formation
            </h4>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: formationEvents.length > 0 ? '#FEE2E2' : '#F3F4F6',
              color: formationEvents.length > 0 ? '#DC2626' : '#6B7280',
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {formationEvents.length} Recorded
            </span>
          </div>

          {formationEvents.length === 0 ? (
            <div style={{
              padding: '14px',
              textAlign: 'center',
              backgroundColor: '#FAFAF9',
              borderRadius: '6px',
              border: '1px dashed #D6D3D1',
              color: '#78716C',
              fontSize: '0.82rem'
            }}>
              No subsurface incidents recorded at this formation horizon for this well.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {formationEvents.map((evt, idx) => {
                const badge = getSeverityBadge(evt.severity);
                return (
                  <div
                    key={evt.id || idx}
                    style={{
                      backgroundColor: '#FFF8ED',
                      border: '1px solid #F0DCC0',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#1A1410' }}>
                        {formatEventType(evt.event_type)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          {evt.severity || 'LOW'}
                        </span>
                        <span style={{ color: '#6B7280', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          @{formatDepth(evt.depth)}
                        </span>
                      </div>
                    </div>
                    {evt.description && (
                      <p style={{ margin: '4px 0', color: '#4B5563', lineHeight: 1.4, fontStyle: 'italic' }}>
                        "{evt.description}"
                      </p>
                    )}
                    {evt.mitigation && (
                      <div style={{ marginTop: '4px', fontSize: '0.76rem', color: '#047857' }}>
                        <strong>Applied Mitigation:</strong> {evt.mitigation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Associated Risks in Depth Range */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1A1410', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={15} style={{ color: '#D97706' }} /> Associated Subsurface Risks
            </h4>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              backgroundColor: formationRisks.length > 0 ? '#FEF3C7' : '#F3F4F6',
              color: formationRisks.length > 0 ? '#D97706' : '#6B7280',
              padding: '2px 8px',
              borderRadius: '10px'
            }}>
              {formationRisks.length} Active
            </span>
          </div>

          {formationRisks.length === 0 ? (
            <div style={{
              padding: '14px',
              textAlign: 'center',
              backgroundColor: '#FAFAF9',
              borderRadius: '6px',
              border: '1px dashed #D6D3D1',
              color: '#78716C',
              fontSize: '0.82rem'
            }}>
              No active elevated risks calculated for this formation interval.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {formationRisks.map((risk, idx) => {
                const badge = getSeverityBadge(risk.risk_level);
                return (
                  <div
                    key={risk.id || idx}
                    style={{
                      backgroundColor: '#FFF8ED',
                      border: '1px solid #F0DCC0',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, color: '#1A1410', textTransform: 'capitalize' }}>
                        {risk.risk_type?.replace(/_/g, ' ')}
                      </span>
                      <span style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase'
                      }}>
                        {risk.risk_level || 'EVALUATED'} &middot; {((risk.score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    {risk.description && (
                      <div style={{ color: '#4B5563', lineHeight: 1.4 }}>
                        {risk.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Offset Wells Penetrating this Formation */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1A1410', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ExternalLink size={15} style={{ color: '#2563EB' }} /> Correlated Offset Wells ({penetratingWells.length})
            </h4>
            <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>
              Traversing {formationName}
            </span>
          </div>

          {loadingWells ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#6B7280', fontSize: '0.8rem' }}>
              Querying regional stratigraphic correlation...
            </div>
          ) : penetratingWells.length === 0 ? (
            <div style={{
              padding: '14px',
              textAlign: 'center',
              backgroundColor: '#FAFAF9',
              borderRadius: '6px',
              border: '1px dashed #D6D3D1',
              color: '#78716C',
              fontSize: '0.82rem'
            }}>
              No other wells found in database penetrating this specific horizon.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
              {penetratingWells.slice(0, 10).map((w) => (
                <div
                  key={w.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#F7F3EC',
                    border: '1px solid #E8DCC8',
                    fontSize: '0.8rem'
                  }}
                >
                  <div>
                    <strong style={{ color: '#1A1410', display: 'block' }}>{w.well_name}</strong>
                    <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                      {w.field || 'Assam Field'} &middot; Depth: {formatDepth(w.top_depth)} – {formatDepth(w.bottom_depth)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/wells/${w.id}`);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D1C7B8',
                      borderRadius: '4px',
                      color: '#5A3D28',
                      cursor: 'pointer'
                    }}
                  >
                    View <ArrowUpRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </Drawer>
  );
}
