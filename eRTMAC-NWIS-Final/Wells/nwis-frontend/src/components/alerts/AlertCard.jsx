import React, { useState } from 'react';
import { alertsAPI } from '../../api/client';
import { RoleGate } from '../auth/RoleGate';
import { formatDepth } from '../../utils/formatters';
import EvidencePanel from '../evidence/EvidencePanel';
import { ThumbsUp, ThumbsDown, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import './AlertCard.css';

const AlertCard = ({ alert, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(alert.feedback || null);

  const handleAcknowledge = async () => {
    try {
      setLoading(true);
      await alertsAPI.acknowledge(alert.id);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    try {
      setLoading(true);
      await alertsAPI.resolve(alert.id);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (val) => {
    try {
      setLoading(true);
      const nextVal = feedbackStatus === val ? null : val;
      await alertsAPI.feedback(alert.id, nextVal);
      setFeedbackStatus(nextVal);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to record alert feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusClass = `alert-status-${alert.status?.toLowerCase() || 'generated'}`;
  const severityClass = `alert-severity-${alert.severity?.toLowerCase() || 'info'}`;
  const snapshot = alert.parameter_snapshot || {};
  const hasSnapshot = Object.keys(snapshot).length > 0;

  const firstDepth = alert.first_seen_depth !== undefined && alert.first_seen_depth !== null ? parseFloat(alert.first_seen_depth) : (alert.depth ? parseFloat(alert.depth) : null);
  const lastDepth = alert.last_seen_depth !== undefined && alert.last_seen_depth !== null ? parseFloat(alert.last_seen_depth) : firstDepth;

  return (
    <div className={`alert-card ${severityClass}`}>
      <div className="alert-card-header">
        <div className="alert-badges" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`alert-badge severity`}>{alert.severity}</span>
          <span className={`alert-badge status ${statusClass}`}>{alert.status}</span>
          {alert.occurrence_count > 1 && (
            <span className="alert-badge occurrence" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
              ⚡ Triggered {alert.occurrence_count}x
            </span>
          )}
          {alert.score !== undefined && alert.score !== null && (
            <span className="alert-badge score" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              {Math.round(alert.score * 100)}% Risk
            </span>
          )}
        </div>
        <div className="alert-meta">
          <span className="alert-well">{alert.well_name}</span>
          {firstDepth !== null && (
            <span className="alert-depth" style={{ fontFamily: 'var(--font-mono)' }}>
              {formatDepth(firstDepth)}
              {lastDepth && lastDepth !== firstDepth && ` → ${formatDepth(lastDepth)}`}
            </span>
          )}
        </div>
      </div>
      
      <div className="alert-card-body">
        <h4 className="alert-risk-type">{alert.risk_type?.replace(/_/g, ' ')}</h4>
        <p className="alert-message">{alert.message || alert.explanation}</p>
      </div>

      <div className="alert-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {alert.evidence && alert.evidence.length > 0 && (
            <button 
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setShowEvidence(!showEvidence)}
            >
              {showEvidence ? 'Hide Evidence' : 'View Evidence'}
            </button>
          )}

          {hasSnapshot && (
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setShowSnapshot(!showSnapshot)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Activity size={13} />
              {showSnapshot ? 'Hide Telemetry' : 'Snapshot'}
              {showSnapshot ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {/* True / False Positive Feedback Buttons */}
          <div className="feedback-buttons" style={{ display: 'inline-flex', gap: '4px', marginLeft: '6px' }}>
            <button
              type="button"
              className={`btn btn-xs ${feedbackStatus === 'true_positive' ? 'btn-success' : 'btn-outline-secondary'}`}
              onClick={() => handleFeedback('true_positive')}
              disabled={loading}
              title="Confirm genuine anomaly (True Positive)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', padding: '3px 7px' }}
            >
              <ThumbsUp size={11} /> True Pos
            </button>
            <button
              type="button"
              className={`btn btn-xs ${feedbackStatus === 'false_positive' ? 'btn-danger' : 'btn-outline-secondary'}`}
              onClick={() => handleFeedback('false_positive')}
              disabled={loading}
              title="Flag false alarm (False Positive)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', padding: '3px 7px' }}
            >
              <ThumbsDown size={11} /> False Pos
            </button>
          </div>
        </div>
        
        <div className="alert-status-actions">
          {(alert.status === 'generated' || alert.status === 'GENERATED' || alert.status === 'delivered') && (
            <RoleGate allowedRoles={['DRILLING_ENGINEER', 'SUPERVISOR', 'SYSTEM_ADMIN', 'driller', 'company_man', 'admin']}>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={handleAcknowledge}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Acknowledge'}
              </button>
            </RoleGate>
          )}
          
          {(alert.status === 'acknowledged' || alert.status === 'ACKNOWLEDGED') && (
            <RoleGate allowedRoles={['DRILLING_ENGINEER', 'SUPERVISOR', 'SYSTEM_ADMIN', 'driller', 'company_man', 'admin']}>
              <button 
                className="btn btn-success btn-sm" 
                onClick={handleResolve}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Resolve'}
              </button>
            </RoleGate>
          )}
        </div>
      </div>

      {/* Snapshot Drawer */}
      {showSnapshot && hasSnapshot && (
        <div className="alert-snapshot-drawer" style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.75rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-primary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Telemetry Snapshot at Trigger Depth ({snapshot.depth || firstDepth}m)</span>
            {snapshot.timestamp && <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>{new Date(snapshot.timestamp).toLocaleTimeString()}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
            {snapshot.wob !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>WOB:</span> <strong>{Number(snapshot.wob).toFixed(1)} kN</strong></div>
            )}
            {snapshot.torque !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Torque:</span> <strong>{Number(snapshot.torque).toFixed(1)} kN·m</strong></div>
            )}
            {snapshot.rop !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>ROP:</span> <strong>{Number(snapshot.rop).toFixed(1)} m/hr</strong></div>
            )}
            {snapshot.rpm !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>RPM:</span> <strong>{Number(snapshot.rpm).toFixed(0)}</strong></div>
            )}
            {snapshot.standpipe_pressure !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>SPP:</span> <strong>{Number(snapshot.standpipe_pressure).toFixed(0)} bar</strong></div>
            )}
            {snapshot.mud_weight !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Mud Wt:</span> <strong>{Number(snapshot.mud_weight).toFixed(2)} sg</strong></div>
            )}
            {snapshot.hook_load !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Hook Load:</span> <strong>{Number(snapshot.hook_load).toFixed(0)} kN</strong></div>
            )}
            {snapshot.additional_parameters?.flow_out_pct !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Flow-out:</span> <strong>{snapshot.additional_parameters.flow_out_pct}%</strong></div>
            )}
            {snapshot.additional_parameters?.pit_volume_delta !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Pit Delta:</span> <strong>{snapshot.additional_parameters.pit_volume_delta} m³</strong></div>
            )}
            {snapshot.additional_parameters?.total_gas_pct !== undefined && (
              <div><span style={{ color: 'var(--color-text-secondary)' }}>Total Gas:</span> <strong>{snapshot.additional_parameters.total_gas_pct}%</strong></div>
            )}
          </div>
        </div>
      )}

      {showEvidence && alert.evidence && (
        <div className="alert-evidence-container">
          <EvidencePanel evidence={alert.evidence} />
        </div>
      )}
    </div>
  );
};

export default AlertCard;
