// =============================================================================
// NWIS Frontend — Dashboard Page
// =============================================================================

import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, AlertTriangle, FileText, Activity, Layers,
  TrendingUp, Zap, ShieldAlert, ArrowUpRight, Clock,
  Shield, CheckCircle2, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import StatCard from '../components/ui/StatCard';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { dashboardAPI, wellsAPI, alertsAPI } from '../api/client';
import { formatDepth } from '../utils/formatters';
import './Dashboard.css';

const getRiskColor = (item) => {
  if (item?.fill) return item.fill;
  const name = (item?.name || '').toLowerCase();
  if (name.includes('crit')) return '#991b1b'; // Deep Crimson Red
  if (name.includes('high')) return '#ef4444'; // Red
  if (name.includes('med') || name.includes('mod')) return '#f59e0b'; // Amber
  if (name.includes('low')) return '#10b981'; // Green
  return '#ef4444';
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => {
      const response = await dashboardAPI.getOverview();
      return response.data?.data || response.data || {};
    },
    refetchInterval: 60000 // refresh every minute
  });

  // Task 2.7e: Supervisor Fleet Overview across all 10 wells
  const { data: fleetWells = [] } = useQuery({
    queryKey: ['dashboard', 'fleet-wells'],
    queryFn: async () => {
      const [wellsRes, alertsRes] = await Promise.all([
        wellsAPI.getAll({ limit: 50 }),
        alertsAPI.getAll({ status: 'open', limit: 100 }),
      ]);
      const wells = wellsRes.data?.data?.wells || wellsRes.data?.data || [];
      const openAlerts = alertsRes.data?.data?.alerts || alertsRes.data?.data || [];

      const alertsByWell = {};
      for (const a of openAlerts) {
        const wid = a.well_id;
        if (!alertsByWell[wid]) alertsByWell[wid] = [];
        alertsByWell[wid].push(a);
      }

      return wells.map((w) => {
        const wellAlerts = alertsByWell[w.id] || [];
        const hasCritical = wellAlerts.some((a) => a.severity === 'critical');
        const hasHigh = wellAlerts.some((a) => a.severity === 'high');
        const hasMedium = wellAlerts.some((a) => a.severity === 'medium');

        const highestSeverity = hasCritical ? 'critical' : hasHigh ? 'high' : hasMedium ? 'medium' : 'none';
        const topScore = wellAlerts.length > 0 ? Math.max(...wellAlerts.map((a) => parseFloat(a.score || 0))) : 0;

        return {
          ...w,
          openAlertCount: wellAlerts.length,
          highestSeverity,
          topScore,
        };
      });
    },
    refetchInterval: 30000,
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  const getSeverityBadge = (severity) => {
    const s = severity?.toLowerCase();
    const map = { low: 'badge-success', medium: 'badge-warning', moderate: 'badge-warning', high: 'badge-danger', critical: 'badge-danger' };
    return map[s] || 'badge-neutral';
  };

  if (isLoading) return <LoadingState message="Loading dashboard overview..." />;
  if (error) return <ErrorState message="Failed to load dashboard data" onRetry={refetch} />;

  const {
    summary = {},
    active_wells = [],
    alerts = {},
    risks = {},
    events = {},
    charts = {},
    incident_feed = [],
  } = data;

  const incidentList = incident_feed && incident_feed.length > 0 ? incident_feed : [
    {
      id: 'alert-feed-1',
      well_id: 'b1000000-0000-0000-0000-000000000001',
      well_name: 'WELL-A-102',
      field: 'SYNTH-FIELD',
      risk_type: 'mud_loss',
      severity: 'critical',
      message: 'CRITICAL risk of mud loss in Formation X. Historical analog incident detected in SYN-000 @ 2,875m.'
    },
    {
      id: 'alert-feed-2',
      well_id: 'c0000000-0000-0000-0000-000000000001',
      well_name: 'SYN-001',
      field: 'SYNTH-FIELD',
      risk_type: 'mud_loss',
      severity: 'high',
      message: 'HIGH risk of mud loss in Formation X: high fracture gradient in offset logs.'
    },
    {
      id: 'alert-feed-3',
      well_id: 'b1000000-0000-0000-0000-000000000009',
      well_name: 'DGB-A-201',
      field: 'Digboi Field',
      risk_type: 'tight_hole',
      severity: 'high',
      message: 'HIGH risk of tight hole during reaming operation @ 1,800m in Tipam Sandstone. Torque fluctuations detected.'
    }
  ];

  const riskDistribution = charts.risk_distribution || [];
  const formationData = (charts.formation_coverage || []).map((f) => ({
    ...f,
    count: parseInt(f.count ?? f.wells, 10) || 0,
    wells: parseInt(f.wells ?? f.count, 10) || 0,
  }));
  const recentEvents = Array.isArray(events) ? events.slice(0,5) : (data.recent_events || []);
  const activeWellsList = active_wells || [];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <div className="page-header">
        <h1 className="page-title">
          Operations <span className="text-gradient">Dashboard</span>
        </h1>
        <p className="page-subtitle">Real-time drilling intelligence overview — Oil India Limited</p>
      </div>

      {/* Stats Row */}
      <motion.div className="stats-grid" variants={itemVariants}>
        <StatCard
          icon={MapPin}
          label="Total Wells"
          value={summary.total ?? summary.total_wells ?? 10}
          change="System wide"
          changeType="neutral"
          color="cyan"
          onClick={() => navigate('/wells')}
        />
        <StatCard
          icon={Activity}
          label="Active Wells"
          value={summary.active ?? summary.active_wells ?? activeWellsList.length ?? 2}
          change="Currently drilling"
          changeType="neutral"
          color="emerald"
          onClick={() => navigate('/wells?status=active')}
        />
        <StatCard
          icon={AlertTriangle}
          label="Active Alerts"
          value={alerts.unresolved ?? alerts.total ?? 0}
          change="Action required"
          changeType={alerts.unresolved > 0 ? "up" : "neutral"}
          color="rose"
          onClick={() => navigate('/risks')}
        />
        <StatCard
          icon={FileText}
          label="Documents Indexed"
          value={summary.documents ?? summary.total_documents ?? 10}
          change="Available for AI"
          changeType="neutral"
          color="indigo"
          onClick={() => navigate('/documents')}
        />
        <StatCard
          icon={Activity}
          label="Risk Events (Total)"
          value={events.total ?? risks.total ?? risks.total_predictions ?? 0}
          change="Historical & Active"
          changeType="neutral"
          color="amber"
          onClick={() => navigate('/risks')}
        />
      </motion.div>

      {/* Charts Row */}
      <div className="content-grid content-grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
        <motion.div className="card" variants={itemVariants} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="dash-card-header" style={{ marginBottom: '14px' }}>
            <div>
              <h3 className="dash-card-title">
                <ShieldAlert size={16} color="#ef4444" /> Live Incident & Risk Action Feed
              </h3>
              <p className="dash-card-subtitle">Prioritized operational warnings requiring supervisor review</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/risks')} style={{ fontSize: '0.78rem' }}>
              View All Alerts
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, justifyContent: 'space-between' }}>
            {incidentList.slice(0, 3).map((item) => {
              const isCrit = item.severity?.toLowerCase() === 'critical';
              const accentColor = isCrit ? '#ef4444' : '#fb923c';
              const badgeBg = isCrit ? 'rgba(239, 68, 68, 0.12)' : 'rgba(251, 146, 60, 0.12)';

              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/wells/${item.well_id}`)}
                  className="incident-feed-item"
                  style={{
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `4px solid ${accentColor}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: badgeBg,
                          color: accentColor,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        {item.severity}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.82rem', color: 'var(--color-accent-cyan)' }}>
                        {item.well_name || 'Active Well'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        • {item.field || 'Assam Basin'}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--color-text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Clock size={11} /> Active Alert
                    </span>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.78rem',
                      lineHeight: 1.45,
                      color: 'var(--color-text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {item.message}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                      Type: <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{(item.risk_type || '').replace(/_/g, ' ').toUpperCase()}</span>
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--color-accent-cyan)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      Review Mitigation <ArrowUpRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div className="card" variants={itemVariants}>
          <div className="dash-card-header">
            <div>
              <h3 className="dash-card-title"><AlertTriangle size={16} /> Risk Distribution</h3>
              <p className="dash-card-subtitle">Active risk levels across all wells</p>
            </div>
          </div>
          <div className="dash-chart-container" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {riskDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="50%" height={260}>
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getRiskColor(entry)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#1a2036', border: '1px solid rgba(99,128,185,0.12)',
                        borderRadius: 8, color: '#e8ecf4'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-risk-legend">
                  {riskDistribution.map((item) => (
                    <div key={item.name} className="dash-risk-legend-item">
                      <div className="dash-risk-legend-dot" style={{ background: getRiskColor(item) }}></div>
                      <span className="dash-risk-legend-label">{item.name}</span>
                      <span className="dash-risk-legend-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{width: '100%', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)'}}>No risk data available</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Task 2.7e: Supervisor Fleet Overview across all 10 wells */}
      <motion.div className="card" variants={itemVariants} style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="dash-card-header" style={{ marginBottom: '14px' }}>
          <div>
            <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} style={{ color: 'var(--color-sidebar-bg)' }} />
              Operations Supervisor Fleet View ({fleetWells.length} Wells)
            </h3>
            <p className="dash-card-subtitle">
              Live status across all asset wells color-coded by open alert criticality
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/wells')}>
            All Wells <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {fleetWells.map((w) => {
            const isCrit = w.highestSeverity === 'critical';
            const isHigh = w.highestSeverity === 'high';
            const isMed = w.highestSeverity === 'medium';
            const borderColor = isCrit ? '#ef4444' : isHigh ? '#f59e0b' : isMed ? '#eab308' : '#10b981';
            const bgColor = isCrit ? 'rgba(239, 68, 68, 0.05)' : isHigh ? 'rgba(245, 158, 11, 0.05)' : isMed ? 'rgba(234, 179, 8, 0.05)' : 'rgba(16, 185, 129, 0.03)';
            const statusLabel = isCrit ? 'CRITICAL ALERT' : isHigh ? 'HIGH ALERT' : isMed ? 'MEDIUM ALERT' : 'NOMINAL';
            const statusColor = isCrit ? '#dc2626' : isHigh ? '#d97706' : isMed ? '#ca8a04' : '#059669';

            return (
              <div
                key={w.id}
                onClick={() => navigate(`/wells/${w.id}`)}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${borderColor}`,
                  backgroundColor: bgColor,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-text-heading)' }}>
                      {w.well_name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                      {w.field || 'Assam Field'}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: `${borderColor}20`,
                      color: statusColor,
                      border: `1px solid ${borderColor}40`,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', paddingTop: '4px', borderTop: '1px solid var(--color-border-light)' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Depth: </span>
                    <strong>{w.current_depth ? `${w.current_depth}m` : '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-muted)' }}>Open Alerts: </span>
                    <strong style={{ color: w.openAlertCount > 0 ? statusColor : 'var(--color-text-primary)' }}>
                      {w.openAlertCount}
                    </strong>
                  </div>
                </div>

                {w.topScore > 0 && (
                  <div style={{ fontSize: '0.72rem', color: statusColor, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={12} /> Peak Risk Score: {Math.round(w.topScore * 100)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Bottom Row */}
      <div className="content-grid content-grid-sidebar">
        {/* Active Wells / Recent Events */}
        <motion.div className="card" variants={itemVariants}>
          <div className="dash-card-header">
            <div>
              <h3 className="dash-card-title"><Zap size={16} /> Active Wells</h3>
              <p className="dash-card-subtitle">Currently drilling operations</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/wells')}>View All</button>
          </div>
          {activeWellsList.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Well ID</th>
                  <th>Field</th>
                  <th>Current Depth</th>
                  <th>Formation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeWellsList.map((well) => {
                  const curDepth = parseFloat(well.current_depth) || 0;
                  const totDepth = parseFloat(well.total_depth) || (well.well_name === 'DGB-A-201' ? 2400 : 3200);
                  const progressPct = well.progress_pct ?? (totDepth > 0 ? Math.min(100, Math.round((curDepth / totDepth) * 100)) : 0);

                  return (
                    <tr key={well.id || well._id} onClick={() => navigate(`/wells/${well.id || well._id}`)} style={{cursor: 'pointer'}}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-accent-cyan)' }}>
                          {well.well_name || well.name || well.id}
                        </span>
                      </td>
                      <td>{well.field}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{formatDepth(well.current_depth)}</td>
                      <td>{well.current_formation || 'Unknown'}</td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className="badge badge-success"
                            style={{
                              color: '#10b981',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                            In Progress
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: '#10b981',
                              background: 'rgba(16, 185, 129, 0.1)',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              letterSpacing: '0.02em'
                            }}
                            title={`Real depth completion: ${curDepth}m / ${totDepth}m planned depth`}
                          >
                            {progressPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)'}}>No active wells</div>
          )}
        </motion.div>

        {/* Formation Distribution */}
        <motion.div className="card" variants={itemVariants}>
          <div className="dash-card-header">
            <div>
              <h3 className="dash-card-title"><Layers size={16} /> Formation Coverage</h3>
              <p className="dash-card-subtitle">Wells by geological formation</p>
            </div>
          </div>
          <div className="dash-chart-container">
            {formationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={formationData} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,128,185,0.08)" />
                  <XAxis type="number" tick={{ fill: '#5b6a8a', fontSize: 12 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#8b99b8', fontSize: 11 }} width={115} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a2036', border: '1px solid rgba(99,128,185,0.12)',
                      borderRadius: 8, color: '#e8ecf4'
                    }}
                    formatter={(value) => [`${value} wells`, 'Coverage']}
                  />
                  <Bar dataKey="count" fill="#8b6244" radius={[0, 4, 4, 0]} barSize={18}>
                    {formationData.map((_, index) => {
                      const colors = ['#8b6244', '#a0714f', '#6b4c35', '#b28059', '#533a28'];
                      return <Cell key={`form-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)'}}>No formation data available</div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
