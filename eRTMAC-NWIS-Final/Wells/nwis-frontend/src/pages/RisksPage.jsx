import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Shield, TrendingUp, MapPin, Activity, CheckCircle, RefreshCw, Target } from 'lucide-react';
import { risksAPI, wellsAPI } from '../api/client';
import StatCard from '../components/ui/StatCard';
import RiskCard from '../components/risk/RiskCard';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import './RisksPage.css';

export default function RisksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeWellId, setActiveWellId] = useState('b1000000-0000-0000-0000-000000000001');
  const [currentDepth, setCurrentDepth] = useState(2850);

  // Queries
  const { data: allWellsData } = useQuery({
    queryKey: ['wells', 'all'],
    queryFn: () => wellsAPI.getAll({ limit: 200 })
  });
  const wellsList = allWellsData?.data?.data?.wells || [];

  // Automatically sync current depth when well list or active well changes
  useEffect(() => {
    if (wellsList.length > 0) {
      const found = wellsList.find(w => w.id === activeWellId);
      if (found && found.current_depth) {
        setCurrentDepth(Number(found.current_depth));
      }
    }
  }, [activeWellId, wellsList]);

  const { data: activeRisksData, isLoading: loadingRisks, isError: errorRisks } = useQuery({
    queryKey: ['risks', 'active', activeWellId],
    queryFn: () => risksAPI.getActive(activeWellId),
    enabled: !!activeWellId
  });

  const { data: allRisksData } = useQuery({
    queryKey: ['risks', 'all', activeWellId],
    queryFn: () => risksAPI.getByWell(activeWellId, { limit: 10 }),
    enabled: !!activeWellId
  });

  // Mutation for explicit depth re-evaluation
  const evaluateMutation = useMutation({
    mutationFn: () => risksAPI.evaluate({ well_id: activeWellId, depth: currentDepth }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['risks', 'active', activeWellId]);
    }
  });

  // Prioritize live evaluated risks if mutation succeeded, else active risks from backend
  const evaluatedData = evaluateMutation.data?.data?.data || evaluateMutation.data?.data;
  const activeData = activeRisksData?.data?.data || {};
  const rawRisks = evaluatedData?.risks || activeData?.risks || [];
  const meta = evaluatedData || activeData;

  // Deduplicate by risk_type so the user sees clean, distinct risk cards
  const risksMap = new Map();
  for (const r of rawRisks) {
    const key = r.risk_type;
    const existing = risksMap.get(key);
    const scoreVal = typeof r.score === 'string' ? parseFloat(r.score) : (r.score || 0);
    const existingScore = existing ? (typeof existing.score === 'string' ? parseFloat(existing.score) : (existing.score || 0)) : -1;
    if (!existing || scoreVal > existingScore) {
      risksMap.set(key, r);
    }
  }
  const risksArray = Array.from(risksMap.values()).sort((a, b) => {
    const sA = (a.score > 1 ? a.score : a.score * 100) || 0;
    const sB = (b.score > 1 ? b.score : b.score * 100) || 0;
    return sB - sA;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Risk <span className="text-gradient">Intelligence</span></h1>
          <p className="page-subtitle">AI-powered drilling risk assessment (Historical Context)</p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={16} className="text-primary" />
            <select 
              value={activeWellId} 
              onChange={e => {
                const newId = e.target.value;
                setActiveWellId(newId);
                const found = wellsList.find(w => w.id === newId);
                if (found && found.current_depth) {
                  setCurrentDepth(Number(found.current_depth));
                }
              }}
              className="input select"
              style={{ width: '200px', background: 'var(--color-surface)' }}
            >
              {wellsList.map(w => (
                <option key={w.id} value={w.id}>{w.well_name}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="number" 
              value={currentDepth}
              onChange={e => setCurrentDepth(Number(e.target.value))}
              className="input"
              style={{ width: '100px' }}
              title="Simulated Depth for Evaluation"
            />
            <button 
              className="btn btn-primary"
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
            >
              {evaluateMutation.isPending ? <RefreshCw size={16} className="spin" /> : <RefreshCw size={16} />}
              Evaluate Current Context
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <StatCard icon={AlertTriangle} label="Identified Risks" value={risksArray.length} color="rose" />
        <StatCard icon={Shield} label="Evaluation Status" value={meta?.model_version || 'RTMAC-v2'} color="indigo" />
        <StatCard icon={Activity} label="Current Depth Context" value={`${currentDepth}m`} color="emerald" />
        <StatCard icon={CheckCircle} label="Last Evaluated" value={meta?.evaluated_at ? new Date(meta.evaluated_at).toLocaleTimeString() : 'Just now'} color="amber" />
      </div>

      {loadingRisks ? (
        <LoadingState message="Fetching risk intelligence..." />
      ) : errorRisks ? (
        <ErrorState message="Failed to load risks data." />
      ) : risksArray.length === 0 ? (
        <EmptyState icon={Shield} title="No Active Risks" message="The AI model has not identified any significant risks for the current context." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {evaluateMutation.isSuccess && (
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} /> Evaluation complete. View updated risk context below.
            </div>
          )}
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(600px, 1fr))', gap: '24px' }}>
            {risksArray.map((risk, i) => (
              <RiskCard key={risk.id || i} risk={risk} />
            ))}
          </div>
        </div>
      )}

    </motion.div>
  );
}
