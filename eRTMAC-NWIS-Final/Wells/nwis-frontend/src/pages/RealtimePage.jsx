import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Target, Box, ExternalLink, FileCode, CheckCircle, AlertTriangle, X, Upload, Wifi, WifiOff, Zap, Brain, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { wellsAPI, realtimeAPI, mlAPI } from '../api/client';
import useWellRealtime from '../hooks/useWellRealtime';
import useAIReplay from '../hooks/useAIReplay';

import RealtimeHeader from '../components/realtime/RealtimeHeader';
import LiveParameterStrip from '../components/realtime/LiveParameterStrip';
import LiveAlertPanel from '../components/realtime/LiveAlertPanel';

import './RealtimePage.css';
import ActiveWellContextBar from '../components/wells/ActiveWellContextBar';
import SourceDocumentLink from '../components/evidence/SourceDocumentLink';
import EvidenceCard from '../components/evidence/EvidenceCard';

export default function RealtimePage() {
  const WELL_A_102_ID = 'b1000000-0000-0000-0000-000000000001';
  const [activeWellId, setActiveWellId] = useState(WELL_A_102_ID);
  
  const { data: allWellsData } = useQuery({
    queryKey: ['wells', 'all'],
    queryFn: () => wellsAPI.getAll({ limit: 200 })
  });
  const wellsList = allWellsData?.data?.data?.wells || [];
  const activeWell = wellsList.find(w => w.id === activeWellId) || wellsList[0];
  const replayWellIdentifier = activeWell?.well_name || 'WELL-A-102';

  const { connected, realtimeState, alerts } = useWellRealtime(activeWellId);
  const [chartData, setChartData] = useState([]);
  const MAX_POINTS = 50;
  const isWellA102 = activeWellId === WELL_A_102_ID;

  // AI Replay State
  const [aiReplaySpeed, setAiReplaySpeed] = useState(2.0);
  const {
    connected: aiConnected,
    replayState: aiReplayState,
    risks: aiRisks,
    done: aiDone,
    error: aiError,
    connect: startAIReplay,
    disconnect: stopAIReplay,
  } = useAIReplay(replayWellIdentifier, { speed: aiReplaySpeed, every: 3 });

  // ML Prediction State: cache predictions for all 3 models so switching tabs is instant!
  const [mlPredictions, setMlPredictions] = useState({});
  const [mlPrediction, setMlPrediction] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlEventType, setMlEventType] = useState('mud_loss');
  const [expandedRiskIndex, setExpandedRiskIndex] = useState(null);

  const activeMLPrediction = mlPredictions[mlEventType] || mlPrediction;

  // WITSML Modal State
  const [showWitsmlModal, setShowWitsmlModal] = useState(false);
  const [witsmlLoading, setWitsmlLoading] = useState(false);
  const [witsmlResult, setWitsmlResult] = useState(null);
  const [witsmlError, setWitsmlError] = useState(null);

  // Only use backend SSE for chart when AI replay is NOT active (single data source)
  useEffect(() => {
    if (!aiConnected && realtimeState) {
      setChartData(prev => {
        const newData = [...prev, realtimeState];
        if (newData.length > MAX_POINTS) return newData.slice(newData.length - MAX_POINTS);
        return newData;
      });
    }
  }, [realtimeState, aiConnected]);

  // Append AI replay data to chart too
  useEffect(() => {
    if (aiReplayState) {
      setChartData(prev => {
        const point = {
          ...aiReplayState,
          standpipe_pressure: aiReplayState.standpipe_pressure ?? aiReplayState.pressure,
          mud_flow_rate: aiReplayState.mud_flow_rate ?? aiReplayState.mud_flow,
          mud_loss: aiReplayState.mud_loss ?? 0,
        };
        const newData = [...prev, point];
        if (newData.length > MAX_POINTS) return newData.slice(newData.length - MAX_POINTS);
        return newData;
      });
    }
  }, [aiReplayState]);

  // Clean transition to AI replay - stop backend replay and clear chart data
  const handleStartAIReplay = async () => {
    try {
      await realtimeAPI.stopReplay();
    } catch (_) {}
    setChartData([]);
    startAIReplay();
  };

  // Fetch ML prediction helper for all event types or a specific event type
  const currentDepth = aiReplayState?.depth || realtimeState?.depth || 2840;

  const fetchMLPredictions = useCallback(async (targetEventType, targetDepth) => {
    const depthToUse = targetDepth || (currentDepth && currentDepth >= 2800 ? currentDepth : 2840);
    const typesToFetch = targetEventType ? [targetEventType] : ['mud_loss', 'stuck_pipe', 'torque_spike'];
    setMlLoading(true);
    try {
      const results = await Promise.allSettled(
        typesToFetch.map(et => mlAPI.predict(replayWellIdentifier, {
          depth: depthToUse,
          event_type: et,
          explain: true
        }))
      );
      const newPredictions = {};
      results.forEach((res, i) => {
        const et = typesToFetch[i];
        if (res.status === 'fulfilled' && res.value?.data?.data) {
          newPredictions[et] = res.value.data.data;
        }
      });
      if (Object.keys(newPredictions).length > 0) {
        setMlPredictions(prev => ({ ...prev, ...newPredictions }));
        const activeType = targetEventType || mlEventType;
        if (newPredictions[activeType]) {
          setMlPrediction(newPredictions[activeType]);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch ML predictions:', err?.message);
    } finally {
      setMlLoading(false);
    }
  }, [currentDepth, replayWellIdentifier, mlEventType]);

  const handleSelectEventType = (eventType) => {
    setMlEventType(eventType);
    if (mlPredictions[eventType]) {
      setMlPrediction(mlPredictions[eventType]);
    } else {
      fetchMLPredictions(eventType, currentDepth);
    }
  };

  // Initial fetch on mount or well change so ML predictions for all models are ready immediately
  useEffect(() => {
    if (isWellA102 && Object.keys(mlPredictions).length === 0) {
      fetchMLPredictions(null, currentDepth || 2840);
    }
  }, [isWellA102, fetchMLPredictions, currentDepth, mlPredictions]);

  // Periodic update during active replay when depth advances past 2800m
  useEffect(() => {
    if (!currentDepth || currentDepth < 2800 || !isWellA102) return;
    fetchMLPredictions(null, currentDepth);
  }, [Math.floor((currentDepth || 0) / 10), replayWellIdentifier, isWellA102]);

  // Check replay status
  const { data: replayStatusData } = useQuery({
    queryKey: ['realtime', 'replay-status'],
    queryFn: () => realtimeAPI.getReplayStatus(),
    refetchInterval: 3000
  });
  const isReplayMode = replayStatusData?.data?.active || aiConnected;

  const handleIngestWitsml = async (xmlString = null) => {
    try {
      setWitsmlLoading(true);
      setWitsmlError(null);
      const res = await realtimeAPI.uploadWitsml(activeWellId, xmlString ? { xml: xmlString } : {});
      setWitsmlResult(res.data?.data || res.data);
      if (res.data?.data?.latestState) {
        setChartData(prev => [...prev, res.data.data.latestState]);
      }
    } catch (err) {
      setWitsmlError(err.response?.data?.message || err.message || 'Failed to ingest WITSML file');
    } finally {
      setWitsmlLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      handleIngestWitsml(event.target.result);
    };
    reader.readAsText(file);
  };

  // Live Telemetry Alerts Synthesized Directly from Stream State
  const liveTelemetryAlerts = [];
  if (aiConnected && aiReplayState) {
    const mudLossVal = Number(aiReplayState.mud_loss || 0);
    const torqueVal = Number(aiReplayState.torque || 0);
    const sppVal = Number(aiReplayState.standpipe_pressure ?? aiReplayState.pressure ?? 0);

    if (mudLossVal > 0.5) {
      liveTelemetryAlerts.push({
        id: 'live-telemetry-mud-loss',
        risk_type: 'mud_loss',
        risk_level: mudLossVal > 10 ? 'critical' : 'high',
        score: Math.min(100, Math.round(75 + mudLossVal)),
        score_100: Math.min(100, Math.round(75 + mudLossVal)),
        depth_range: [Math.round(currentDepth - 10), Math.round(currentDepth + 30)],
        is_live_telemetry: true,
        reasons: [
          `Active Telemetry Anomaly: Real-time mud loss of ${mudLossVal.toFixed(1)} m³/hr detected at ${Number(aiReplayState.depth).toFixed(1)}m MD`,
          `Thief formation fracture zone encountered in ${aiReplayState.formation || 'Kopili Formation'}`
        ],
        evidence: [
          {
            well_name: replayWellIdentifier,
            depth: Number(aiReplayState.depth).toFixed(0),
            severity: 'CRITICAL',
            quote: `Active telemetry indicates pit volume decrease and flow return drop. Mud Flow: ${Number(aiReplayState.mud_flow_rate || aiReplayState.mud_flow || 0).toFixed(0)} L/min.`,
            mitigation: 'Pump LCM (Lost Circulation Material) pill, reduce pump rate, monitor active pits.'
          }
        ]
      });
    }

    if (torqueVal >= 24.5) {
      liveTelemetryAlerts.push({
        id: 'live-telemetry-torque-spike',
        risk_type: 'torque_spike',
        risk_level: 'high',
        score: Math.min(100, Math.round(60 + torqueVal)),
        score_100: Math.min(100, Math.round(60 + torqueVal)),
        depth_range: [Math.round(currentDepth - 20), Math.round(currentDepth + 20)],
        is_live_telemetry: true,
        reasons: [
          `Active Telemetry Anomaly: Elevated drillstring torque (${torqueVal.toFixed(1)} kN·m) indicating formation drag or tight hole`,
          `High friction factor observed on rotary string`
        ],
        evidence: [
          {
            well_name: replayWellIdentifier,
            depth: Number(aiReplayState.depth).toFixed(0),
            severity: 'HIGH',
            quote: 'Torque erratic fluctuations exceeding nominal baseline threshold of 22 kN·m.',
            mitigation: 'Reduce WOB and RPM, circulate bottoms up, monitor cutting sizes for cavings.'
          }
        ]
      });
    }

    if (sppVal > 0 && sppVal < 2880 && mudLossVal > 0.5) {
      liveTelemetryAlerts.push({
        id: 'live-telemetry-spp-drop',
        risk_type: 'standpipe_pressure_drop',
        risk_level: 'high',
        score: 80,
        score_100: 80,
        depth_range: [Math.round(currentDepth - 10), Math.round(currentDepth + 10)],
        is_live_telemetry: true,
        reasons: [
          `Active Telemetry Anomaly: SPP drop to ${sppVal.toFixed(0)} bar correlated with circulation loss`
        ],
        evidence: [
          {
            well_name: replayWellIdentifier,
            depth: Number(aiReplayState.depth).toFixed(0),
            severity: 'HIGH',
            quote: `SPP drop indicates fluid escaping into thief formation. Check standpipe manifold.`,
            mitigation: 'Verify mud weight, check pump efficiency, prepare loss control procedures.'
          }
        ]
      });
    }
  }

  // Combine live telemetry alerts with correlated offset risks (deduplicated by risk_type)
  const combinedLiveAlerts = aiConnected
    ? [
        ...liveTelemetryAlerts,
        ...aiRisks.filter(r => !liveTelemetryAlerts.some(l => l.risk_type === r.risk_type))
      ]
    : alerts;

  return (
    <div className="realtime-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      
      <ActiveWellContextBar 
        wellName={activeWell?.well_name}
        depth={aiReplayState?.depth || realtimeState?.depth || 2850}
        formation={aiReplayState?.formation || realtimeState?.formation || 'Kopili Formation'}
        status={isReplayMode ? 'REPLAY' : (connected || aiConnected ? 'LIVE' : 'OFFLINE')}
      />

      {/* Top Bar with Well Selector, Link to 3D Simulation & Replay Controls */}
      <div style={{ padding: '12px 24px', backgroundColor: '#FDFBF7', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', position: 'sticky', top: '112px', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Target size={20} className="text-primary" />
          <select 
            value={activeWellId} 
            onChange={e => {
              setActiveWellId(e.target.value);
              setChartData([]);
            }}
            className="input select"
            style={{ width: '220px' }}
          >
            {wellsList.map(w => (
              <option key={w.id} value={w.id}>{w.well_name}</option>
            ))}
          </select>
          {isReplayMode && <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>REPLAY ACTIVE</span>}

          {/* Quick Link to Dedicated 3D Simulation Page */}
          <Link 
            to="/simulation" 
            className="btn btn-sm"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: 'rgba(56, 189, 248, 0.1)', 
              color: '#38bdf8', 
              border: '1px solid rgba(56, 189, 248, 0.25)', 
              borderRadius: '6px', 
              padding: '6px 12px',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <Box size={14} /> Open 3D Simulation <ExternalLink size={12} />
          </Link>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setShowWitsmlModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FileCode size={14} /> WITSML 1.4 Ingest
          </button>

          {/* AI WebSocket Replay Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: aiConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: `1px solid ${aiConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}` }}>
            <Brain size={14} style={{ color: aiConnected ? '#10b981' : '#8b5cf6' }} />
            <select
              value={aiReplaySpeed}
              onChange={e => setAiReplaySpeed(parseFloat(e.target.value))}
              className="input select"
              style={{ width: '70px', padding: '2px 4px', fontSize: '0.8rem' }}
              disabled={aiConnected}
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={5}>5×</option>
              <option value={10}>10×</option>
            </select>
            {!aiConnected ? (
              <button
                className="btn btn-sm"
                onClick={handleStartAIReplay}
                disabled={!isWellA102}
                title={!isWellA102 ? 'AI replay only available for WELL-A-102' : ''}
                style={{ background: isWellA102 ? '#8b5cf6' : '#4b5563', color: '#fff', padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: isWellA102 ? 1 : 0.5, cursor: isWellA102 ? 'pointer' : 'not-allowed' }}
              >
                <Zap size={12} /> AI Replay
              </button>
            ) : (
              <button
                className="btn btn-sm"
                onClick={stopAIReplay}
                style={{ background: '#ef4444', color: '#fff', padding: '4px 10px', fontSize: '0.8rem' }}
              >
                Stop
              </button>
            )}
            {aiConnected && <Wifi size={14} style={{ color: '#10b981' }} />}
            {aiDone && <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>✓ Done</span>}
          </div>
        </div>
      </div>

      <RealtimeHeader 
        wellName={activeWell?.well_name} 
        connected={connected || aiConnected} 
        mode={isReplayMode ? 'REPLAY' : 'LIVE'} 
        depth={aiReplayState?.depth || realtimeState?.depth} 
        formation={aiReplayState?.formation || realtimeState?.formation} 
      />

      {/* Dynamic Incident Phase / AI Risk Escalation Banner */}
      {((aiReplayState?.phase || realtimeState?.phase) || (aiConnected && (combinedLiveAlerts.length > 0 || Number(aiReplayState?.mud_loss) > 0.5 || Number(aiReplayState?.torque) >= 24))) && (
        <div style={{ 
          background: (aiConnected && (combinedLiveAlerts.some(r => r.risk_level === 'critical') || Number(aiReplayState?.mud_loss) > 5.0)) || (aiReplayState?.phase || realtimeState?.phase) === 4 
            ? 'rgba(239, 68, 68, 0.2)' 
            : 'rgba(245, 158, 11, 0.18)',
          borderLeft: `5px solid ${(aiConnected && (combinedLiveAlerts.some(r => r.risk_level === 'critical') || Number(aiReplayState?.mud_loss) > 5.0)) || (aiReplayState?.phase || realtimeState?.phase) === 4 ? '#ef4444' : '#f59e0b'}`,
          padding: '12px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          gap: '16px',
          borderBottom: '1px solid var(--color-border)',
          boxShadow: (aiConnected && (combinedLiveAlerts.some(r => r.risk_level === 'critical') || Number(aiReplayState?.mud_loss) > 5.0)) ? '0 0 16px rgba(239, 68, 68, 0.25)' : 'none'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ 
              background: (aiConnected && (combinedLiveAlerts.some(r => r.risk_level === 'critical') || Number(aiReplayState?.mud_loss) > 5.0)) || (aiReplayState?.phase || realtimeState?.phase) === 4 ? '#ef4444' : '#f59e0b',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '0.82rem',
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              {aiConnected 
                ? (Number(aiReplayState?.mud_loss) > 5.0 || combinedLiveAlerts.some(r => r.risk_level === 'critical') ? '🚨 CRITICAL ESCALATION' : '⚠️ HIGH RISK ALERT') 
                : `PHASE ${aiReplayState?.phase || realtimeState?.phase}`}
            </div>
            <div style={{ 
              color: (aiConnected && (combinedLiveAlerts.some(r => r.risk_level === 'critical') || Number(aiReplayState?.mud_loss) > 5.0)) || (aiReplayState?.phase || realtimeState?.phase) === 4 ? '#ef4444' : '#f59e0b', 
              fontWeight: 700, 
              fontSize: '1.05rem',
              flex: '1 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {aiConnected 
                ? (Number(aiReplayState?.mud_loss) > 0.5 
                    ? `Severe Mud Loss Detected (${Number(aiReplayState.mud_loss).toFixed(1)} m³/hr) in ${aiReplayState?.formation || 'Kopili Formation'}`
                    : combinedLiveAlerts[0]?.reasons?.[0] || 'Drilling parameter anomaly detected in offset formation')
                : (aiReplayState?.phase_label || realtimeState?.phase_label)?.replace(/🚨/g, '').trim()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            {aiConnected && (
              <div style={{ 
                background: '#ef4444', 
                color: '#fff', 
                padding: '5px 12px', 
                borderRadius: '4px', 
                fontWeight: 800, 
                fontSize: '0.85rem', 
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: '135px',
                textAlign: 'center'
              }}>
                MUD LOSS: {Number(aiReplayState?.mud_loss || 0).toFixed(1)} m³/hr
              </div>
            )}
            {aiConnected && Number(aiReplayState?.torque) >= 24.0 && (
              <div style={{ 
                background: '#f59e0b', 
                color: '#fff', 
                padding: '5px 12px', 
                borderRadius: '4px', 
                fontWeight: 800, 
                fontSize: '0.85rem', 
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: '130px',
                textAlign: 'center'
              }}>
                TORQUE: {Number(aiReplayState.torque).toFixed(1)} kN·m
              </div>
            )}
            {activeMLPrediction && (
              <div style={{ 
                background: activeMLPrediction.probability > 0.7 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)', 
                border: `1px solid ${activeMLPrediction.probability > 0.7 ? '#ef4444' : '#f59e0b'}`, 
                color: activeMLPrediction.probability > 0.7 ? '#ef4444' : '#f59e0b', 
                padding: '4px 10px', 
                borderRadius: '4px', 
                fontWeight: 700, 
                fontSize: '0.78rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                minWidth: '105px',
                textAlign: 'center'
              }}>
                ML {activeMLPrediction.event_type?.replace(/_/g, ' ')}: {(activeMLPrediction.probability * 100).toFixed(0)}%
              </div>
            )}
          </div>
        </div>
      )}
      
      <LiveParameterStrip state={aiReplayState || realtimeState} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Main Charts Area */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>Rolling Telemetry</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '24px', flex: 1 }}>
            
            {/* Chart 1: WOB & ROP */}
            <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', minHeight: '320px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--color-text)' }}>WOB (kN) & ROP (m/hr)</h4>
              <div style={{ flex: 1, minHeight: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="depth" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#34d399', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#38bdf8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                    <Line yAxisId="left" type="monotone" dataKey="wob" stroke="#34d399" dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line yAxisId="right" type="monotone" dataKey="rop" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Torque & Pressure */}
            <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', minHeight: '320px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--color-text)' }}>Torque (kN·m) & SPP (bar)</h4>
              <div style={{ flex: 1, minHeight: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="depth" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#f59e0b', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#ef4444', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                    <Line yAxisId="left" type="monotone" dataKey="torque" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} name="Torque (kN·m)" />
                    <Line yAxisId="right" type="monotone" dataKey="standpipe_pressure" stroke="#ef4444" dot={false} strokeWidth={2} isAnimationActive={false} name="SPP (bar)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Mud Flow & Mud Loss (Anomaly Monitor) */}
            <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', minHeight: '320px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)' }}>Flow Rate (L/min) & Mud Loss (m³/hr)</h4>
                <span style={{ fontSize: '0.68rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  ANOMALY MONITOR
                </span>
              </div>
              <div style={{ flex: 1, minHeight: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="depth" tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#38bdf8', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#ef4444', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                    <Line yAxisId="left" type="monotone" dataKey="mud_flow_rate" stroke="#38bdf8" dot={false} strokeWidth={2} isAnimationActive={false} name="Flow Rate (L/min)" />
                    <Line yAxisId="right" type="monotone" dataKey="mud_loss" stroke="#ef4444" dot={false} strokeWidth={2.5} isAnimationActive={false} name="Mud Loss (m³/hr)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
          </div>
        </div>

        {/* Sidebar: Alerts + AI Risks + ML Predictions */}
        <div style={{ width: '380px', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Live Alerts Header & Container */}
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} style={{ color: aiConnected ? '#8b5cf6' : 'var(--color-primary, #38bdf8)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text)' }}>
                  Live Alerts
                </h3>
                {aiConnected && (
                  <span style={{ fontSize: '0.68rem', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                    AI STREAM
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {aiConnected ? `${combinedLiveAlerts.length} Active` : `${alerts.length} Active`}
              </span>
            </div>

            {/* Alert Content */}
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {aiConnected ? (
                // During AI replay: show combined live telemetry alerts and AI offset risks
                combinedLiveAlerts.length === 0 ? (
                  <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '24px 12px', fontSize: '0.84rem' }}>
                    <Wifi size={22} style={{ color: '#10b981', margin: '0 auto 8px', display: 'block' }} />
                    Live telemetry streaming at <strong>{currentDepth ? `${Number(currentDepth).toFixed(1)}m` : 'nominal depth'}</strong>.<br />
                    <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'inline-block' }}>
                      Correlating offset wells every 3 intervals. Monitoring all parameters.
                    </span>
                  </div>
                ) : (
                  combinedLiveAlerts.map((risk, i) => {
                    const isExpanded = expandedRiskIndex === i;
                    const isCritical = risk.risk_level === 'critical';
                    const isLiveTelemetry = risk.is_live_telemetry;

                    return (
                      <div key={i} style={{
                        padding: '14px 16px',
                        marginBottom: '8px',
                        borderRadius: '8px',
                        background: isCritical ? 'rgba(239, 68, 68, 0.18)'
                          : risk.risk_level === 'high' ? 'rgba(245, 158, 11, 0.14)'
                          : 'rgba(139, 92, 246, 0.08)',
                        border: `2px solid ${isCritical ? '#ef4444' : risk.risk_level === 'high' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(139, 92, 246, 0.25)'}`,
                        boxShadow: isCritical ? '0 0 16px rgba(239, 68, 68, 0.35)' : 'none',
                        transition: 'all 0.3s ease',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0 }}>
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', textTransform: 'capitalize', color: isCritical ? '#dc2626' : 'inherit', whiteSpace: 'nowrap' }}>
                              {isCritical && '🚨 '}{risk.risk_type?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: isLiveTelemetry ? 'column' : 'row', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: '#fff',
                              background: isCritical ? '#dc2626' : risk.risk_level === 'high' ? '#f59e0b' : risk.risk_level === 'moderate' || risk.risk_level === 'medium' ? '#3b82f6' : '#6b7280',
                              letterSpacing: '0.5px',
                              whiteSpace: 'nowrap'
                            }}>
                              {isCritical ? 'CRITICAL ESCALATION' : risk.risk_level?.toUpperCase()} • {risk.score_100 || risk.score || 0}/100
                            </span>
                            {isLiveTelemetry && (
                              <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '3px', background: '#dc2626', color: '#fff', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                LIVE ANOMALY
                              </span>
                            )}
                          </div>
                        </div>

                        {risk.depth_range && (
                          <div style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>
                            {isLiveTelemetry ? 'Active Anomaly Interval' : 'Offset Correlated Interval'}: {risk.depth_range[0]}m – {risk.depth_range[1]}m
                          </div>
                        )}

                        {risk.reasons && (
                          <div style={{ 
                            fontSize: '13px', 
                            color: isCritical ? '#991B1B' : 'var(--color-text-secondary)', 
                            lineHeight: 1.45, 
                            fontWeight: isCritical ? 600 : 400,
                            marginTop: '4px'
                          }}>
                            {risk.reasons[0]}
                          </div>
                        )}

                        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setExpandedRiskIndex(isExpanded ? null : i)}
                            style={{ fontSize: '0.72rem', padding: '2px 8px', color: '#38bdf8' }}
                          >
                            {isExpanded ? '▲ Hide Evidence' : `▼ Evidence & Mitigation (${risk.evidence?.length || 0})`}
                          </button>
                          {risk.evidence_strength !== undefined && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                              Strength: {Math.round(risk.evidence_strength * 100)}%
                            </span>
                          )}
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            {risk.reasons && risk.reasons.length > 1 && (
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Risk Signals:</div>
                                {risk.reasons.slice(1).map((r, ri) => (
                                  <div key={ri} style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>• {r}</div>
                                ))}
                              </div>
                            )}

                            {risk.evidence && risk.evidence.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                  {isLiveTelemetry ? 'Telemetry Diagnostics & Mitigations:' : 'Correlated Offset Evidence:'}
                                </div>
                                {risk.evidence.slice(0, 3).map((ev, ei) => (
                                  <EvidenceCard key={ei} evidence={ev} isCritical={isCritical} />
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                {risk.note || 'Correlated with historical offset well telemetry.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              ) : (
                // Standard feed: show LiveAlertPanel
                <LiveAlertPanel alerts={alerts} />
              )}
            </div>
          </div>

          {/* ML Model Prediction */}
          {activeMLPrediction && (
            <div style={{ padding: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '8px', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <Zap size={16} /> ML Prediction
                </h4>
                <span style={{ fontSize: 'clamp(9px, 1.5vw, 10.5px)', whiteSpace: 'nowrap', letterSpacing: '0.3px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, width: 'fit-content', flexShrink: 1 }}>
                  EXPERIMENTAL MODEL
                </span>
              </div>

              {/* Event Type Switch with Live Probability Badges */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { id: 'mud_loss', label: 'Mud Loss' },
                  { id: 'stuck_pipe', label: 'Stuck Pipe' },
                  { id: 'torque_spike', label: 'Torque Spike' }
                ].map(et => {
                  const pred = mlPredictions[et.id];
                  const prob = pred ? (pred.probability * 100).toFixed(1) + '%' : null;
                  const isHigh = pred && pred.probability > 0.6;
                  const isSelected = mlEventType === et.id;

                  return (
                    <button
                      key={et.id}
                      type="button"
                      onClick={() => handleSelectEventType(et.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '5px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        border: '1px solid',
                        background: isSelected 
                          ? (isHigh ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)') 
                          : 'rgba(255,255,255,0.04)',
                        borderColor: isSelected 
                          ? (isHigh ? '#ef4444' : '#f59e0b') 
                          : 'rgba(255,255,255,0.14)',
                        color: isSelected ? (isHigh ? '#ef4444' : '#f59e0b') : 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{et.label}</span>
                      {prob && (
                        <span style={{
                          fontSize: '0.64rem',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: isHigh ? '#ef4444' : pred.probability > 0.3 ? '#f59e0b' : 'rgba(16,185,129,0.2)',
                          color: isHigh ? '#fff' : pred.probability > 0.3 ? '#fff' : '#10b981',
                          fontWeight: 800
                        }}>
                          {prob}
                        </span>
                      )}
                    </button>
                  );
                })}
                {mlLoading && (
                  <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600, marginLeft: 'auto' }}>
                    Evaluating...
                  </span>
                )}
              </div>

              <div style={{
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block' }}>Predicted Incident</span>
                    <strong style={{ 
                      fontSize: '0.98rem', 
                      textTransform: 'capitalize',
                      color: activeMLPrediction.probability > 0.7 ? '#ef4444' : activeMLPrediction.probability > 0.4 ? '#f59e0b' : '#34d399'
                    }}>
                      {activeMLPrediction.event_type?.replace(/_/g, ' ')}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginLeft: '6px', fontWeight: 500 }}>
                      {activeMLPrediction.probability > 0.7 ? '🚨 High Risk Alert' : activeMLPrediction.probability > 0.4 ? '⚠️ Elevated Advisory' : '● Nominal / Low Risk'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'block' }}>Probability</span>
                    <span style={{
                      fontSize: '1.3rem',
                      fontWeight: 800,
                      color: activeMLPrediction.probability > 0.7 ? '#ef4444' : activeMLPrediction.probability > 0.4 ? '#f59e0b' : '#10b981',
                    }}>
                      {(activeMLPrediction.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(5, activeMLPrediction.probability * 100))}%`,
                    height: '100%',
                    background: activeMLPrediction.probability > 0.7 ? '#ef4444' : activeMLPrediction.probability > 0.4 ? '#f59e0b' : '#10b981',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                  Depth: <strong>{activeMLPrediction.depth}m</strong> | Model: <strong>XGBoost ({activeMLPrediction.model || `${mlEventType}_v1`})</strong>
                </div>

                {/* Geological Formation Explanation */}
                <div style={{ 
                  background: 'rgba(0,0,0,0.25)', 
                  borderLeft: `3px solid ${activeMLPrediction.probability > 0.7 ? '#ef4444' : activeMLPrediction.probability > 0.4 ? '#f59e0b' : '#38bdf8'}`,
                  padding: '6px 10px', 
                  borderRadius: '4px', 
                  fontSize: '0.72rem', 
                  color: 'var(--color-text-primary)',
                  marginBottom: '10px'
                }}>
                  {activeMLPrediction.event_type === 'mud_loss' && (
                    <span><strong>Geological Context:</strong> Active Kopili / Formation X contact (2810m–2885m) has known high fracture porosity in offset wells.</span>
                  )}
                  {activeMLPrediction.event_type === 'stuck_pipe' && (
                    <span><strong>Geological Context:</strong> Offset stuck pipe events occur deeper in Barail / Formation Y (3200m+). Active bit at {activeMLPrediction.depth}m is safely above sticking zone.</span>
                  )}
                  {activeMLPrediction.event_type === 'torque_spike' && (
                    <span><strong>Geological Context:</strong> Offset torque anomalies occur in shallow Tipam / Formation C (2050m–2160m). Active bit is well past this interval.</span>
                  )}
                </div>

                {/* Explainability / SHAP Section */}
                {activeMLPrediction.shap_log_odds && typeof activeMLPrediction.shap_log_odds !== 'string' ? (
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>
                      ⚡ Why this prediction? (SHAP Contributions):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {Object.entries(activeMLPrediction.shap_log_odds).slice(0, 8).map(([k, v]) => {
                        const numVal = typeof v === 'number' ? v : parseFloat(v) || 0;
                        const isPositive = numVal > 0;
                        const maxBar = 2.0;
                        const barWidth = Math.min(100, (Math.abs(numVal) / maxBar) * 100);
                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', fontSize: '0.7rem', gap: '6px' }}>
                            <span style={{ color: 'var(--color-text-secondary)', minWidth: '90px', textAlign: 'right' }}>{k.replace(/_/g, ' ')}</span>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: `${barWidth}%`, height: '8px', borderRadius: '2px', background: isPositive ? 'rgba(239, 68, 68, 0.7)' : 'rgba(52, 211, 153, 0.7)', minWidth: '4px', transition: 'width 0.3s ease' }} />
                              <span style={{ fontWeight: 700, color: isPositive ? '#ef4444' : '#34d399', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
                                {isPositive ? '+' : ''}{numVal.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : activeMLPrediction.features ? (
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>
                      ⚡ Feature Drivers:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {Object.entries(activeMLPrediction.features).slice(0, 6).map(([k, v]) => {
                        const numVal = typeof v === 'number' ? v : parseFloat(v) || 0;
                        const isPositive = numVal > 0;
                        return (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{k.replace(/_/g, ' ')}</span>
                            <span style={{
                              fontWeight: 700,
                              color: isPositive ? '#ef4444' : '#34d399',
                              fontFamily: 'var(--font-mono)'
                            }}>
                              {isPositive ? `+${numVal}` : `${numVal}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : activeMLPrediction.shap_log_odds === 'unavailable' ? (
                  <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    SHAP explanations are unavailable for this prediction.
                  </div>
                ) : null}

                {/* Show reasons[0] if available (contains historical event/similar well counts) */}
                {activeMLPrediction.reasons && activeMLPrediction.reasons.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '4px' }}>
                    {activeMLPrediction.reasons[0]}
                  </div>
                )}

                <div style={{ marginTop: '8px', fontSize: '0.68rem', color: 'var(--color-text-muted)', fontStyle: 'italic', lineHeight: 1.3 }}>
                  * Decision-support probability trained on synthetic baseline data. Historical rule engine alerts remain primary.
                </div>
              </div>
            </div>
          )}

          {/* AI Error Display */}
          {aiError && (
            <div style={{ padding: '12px 16px', margin: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '0.82rem', color: '#ef4444' }}>
              {aiError}
            </div>
          )}
        </div>

      </div>

      {/* WITSML Ingestion Modal */}
      {showWitsmlModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: 'var(--color-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={20} className="text-primary" /> WITSML 1.4 Telemetry Adapter
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#f59e0b', marginTop: '4px', fontWeight: 600 }}>
                  File-based adapter (Demonstration Mode) — not a live eRTMAC link
                </div>
              </div>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowWitsmlModal(false)}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Parses standard WITSML 1.4 XML logs with mnemonic conversion (SWOB→kN, SPPA→bar, MWIN→sg, ROPA→m/hr). All data points pass through the NWIS Data Quality Gate for range checks, depth-regression rejection, and spike detection.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleIngestWitsml()}
                disabled={witsmlLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {witsmlLoading ? 'Ingesting...' : 'Load Bundled Sample (sample-witsml-log.xml)'}
              </button>

              <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Upload size={14} /> Upload Custom XML
                <input type="file" accept=".xml" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {witsmlError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '6px', color: '#ef4444', fontSize: '0.82rem', marginBottom: '16px' }}>
                {witsmlError}
              </div>
            )}

            {witsmlResult && (
              <div style={{ background: 'var(--color-background)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
                  <div>Total Lines: <strong>{witsmlResult.totalRows}</strong></div>
                  <div style={{ color: '#10b981' }}>Valid Ingested: <strong>{witsmlResult.validCount}</strong></div>
                  <div style={{ color: '#ef4444' }}>QA Rejections: <strong>{witsmlResult.rejectedCount}</strong></div>
                </div>

                {witsmlResult.rejectedRecords?.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={14} /> Data Quality Gate Exclusions (Demonstration Verified):
                    </div>
                    {witsmlResult.rejectedRecords.map((r, i) => (
                      <div key={i} style={{ background: 'rgba(239,68,68,0.08)', padding: '8px 10px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '4px' }}>
                        <div><strong>Row #{r.row}:</strong> {r.rejectionReason}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>Flags: {r.flags?.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div style={{ fontWeight: 600, marginBottom: '6px' }}>Mapped Channel Status:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {witsmlResult.channels?.map((ch, idx) => (
                      <span key={idx} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', background: ch.status === 'good' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: ch.status === 'good' ? '#10b981' : '#ef4444', border: `1px solid ${ch.status === 'good' ? '#10b981' : '#ef4444'}` }}>
                        {ch.mnemonic} ({ch.targetUnit}): {ch.status.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
