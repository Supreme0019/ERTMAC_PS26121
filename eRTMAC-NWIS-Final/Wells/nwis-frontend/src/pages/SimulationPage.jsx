import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box } from 'lucide-react';
import { wellsAPI, realtimeAPI } from '../api/client';
import useWellRealtime from '../hooks/useWellRealtime';

import RealtimeHeader from '../components/realtime/RealtimeHeader';
import ReplayControls from '../components/realtime/ReplayControls';
import LiveDrillingPanel from '../components/live-drilling/LiveDrillingPanel';

export default function SimulationPage() {
  const [activeWellId, setActiveWellId] = useState('b1000000-0000-0000-0000-000000000001');

  const { data: allWellsData } = useQuery({
    queryKey: ['wells', 'all'],
    queryFn: () => wellsAPI.getAll({ limit: 200 })
  });
  const wellsList = allWellsData?.data?.data?.wells || [];
  const activeWell = wellsList.find(w => w.id === activeWellId) || wellsList[0];

  const { connected, realtimeState, alerts, risks } = useWellRealtime(activeWellId);

  // Replay status
  const { data: replayStatusData } = useQuery({
    queryKey: ['realtime', 'replay-status'],
    queryFn: () => realtimeAPI.getReplayStatus(),
    refetchInterval: 3000
  });
  const isReplayMode = replayStatusData?.data?.active || false;

  return (
    <div className="simulation-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', overflowY: 'auto' }}>
      
      {/* Top Bar with Well Selector & Replay Controls */}
      <div style={{ padding: '12px 24px', background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Box size={20} className="text-primary" />
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>3D Digital Twin Simulation</span>
          <select 
            value={activeWellId} 
            onChange={e => setActiveWellId(e.target.value)}
            className="input select"
            style={{ width: '220px' }}
          >
            {wellsList.map(w => (
              <option key={w.id} value={w.id}>{w.well_name}</option>
            ))}
          </select>
          {isReplayMode && <span style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>REPLAY ACTIVE</span>}
        </div>
        
        <ReplayControls wellId={activeWellId} />
      </div>

      <RealtimeHeader 
        wellName={activeWell?.well_name} 
        connected={connected} 
        mode={isReplayMode ? 'REPLAY' : 'LIVE'} 
        depth={realtimeState?.depth} 
        formation={realtimeState?.formation} 
      />

      {/* Phase Banner */}
      {realtimeState?.phase && (
        <div style={{ 
          background: realtimeState.phase === 4 ? 'rgba(239, 68, 68, 0.2)' : realtimeState.phase === 3 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(52, 211, 153, 0.1)', 
          borderLeft: `4px solid ${realtimeState.phase === 4 ? '#ef4444' : realtimeState.phase === 3 ? '#f59e0b' : '#34d399'}`,
          padding: '12px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ 
              background: realtimeState.phase === 4 ? '#ef4444' : realtimeState.phase === 3 ? '#f59e0b' : '#34d399',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '0.8rem',
              letterSpacing: '1px'
            }}>
              PHASE {realtimeState.phase}
            </div>
            <div style={{ 
              color: realtimeState.phase === 4 ? '#ef4444' : realtimeState.phase === 3 ? '#f59e0b' : 'var(--color-text)', 
              fontWeight: 600, 
              fontSize: '1.1rem' 
            }}>
              {realtimeState.phase_label?.replace(/🚨/g, '').trim()}
            </div>
          </div>
        </div>
      )}

      {/* Full 3D Cutaway Experience */}
      <div style={{ padding: '24px', flex: 1, paddingBottom: '48px' }}>
        <LiveDrillingPanel wellId={activeWellId} liveState={realtimeState} />
      </div>

    </div>
  );
}
