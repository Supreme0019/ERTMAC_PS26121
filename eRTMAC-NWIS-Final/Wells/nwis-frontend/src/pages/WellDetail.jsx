import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Layers, Activity, AlertTriangle,
  Navigation, Clock, Ruler, ExternalLink, ChevronDown, ChevronUp,
  MessageSquare, ShieldAlert, FileText, Printer, CheckCircle2, Shield
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import {
  dashboardAPI, parametersAPI, formationsAPI, eventsAPI, similarityAPI, risksAPI, wellsAPI
} from '../api/client';

import ParameterStrip from '../components/drilling/ParameterStrip';
import FormationTrack from '../components/drilling/FormationTrack';
import FormationDetailDrawer from '../components/drilling/FormationDetailDrawer';
import EventTimeline from '../components/drilling/EventTimeline';
import EventDetailDrawer from '../components/events/EventDetailDrawer';
import EvidencePanel from '../components/evidence/EvidencePanel';
import AlertPanel from '../components/alerts/AlertPanel';

import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

import './WellDetail.css';

const STATUS_CONFIG = {
  active: { class: 'badge-success', label: 'Active' },
  drilling: { class: 'badge-info', label: 'Drilling' },
  completed: { class: 'badge-neutral', label: 'Completed' },
  suspended: { class: 'badge-warning', label: 'Suspended' },
  abandoned: { class: 'badge-danger', label: 'Abandoned' },
};

function getSeverityBadge(severity) {
  const s = severity?.toLowerCase();
  const map = { low: 'badge-success', moderate: 'badge-warning', high: 'badge-danger', critical: 'badge-danger' };
  return map[s] || 'badge-neutral';
}

const SimilarWellCard = ({ well }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="card mb-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div>
          <h4 style={{ margin: 0 }}>{well.well_name}</h4>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Similarity Score: {((well.similarity_score || 0) * 100).toFixed(0)}% • Distance: {well.distance_km != null ? `${Number(well.distance_km).toFixed(1)} km` : '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/wells/${well.backend_well_id || well.id || well.well_id}`); }}>View Well</button>
          {expanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
        </div>
      </div>
      {expanded && well.factors && (
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.9rem' }}>
          <div><strong>Formation Score:</strong> {((well.factors.formation_score || 0) * 100).toFixed(0)}%</div>
          <div><strong>Depth Score:</strong> {((well.factors.depth_score || 0) * 100).toFixed(0)}%</div>
          <div><strong>Trajectory Score:</strong> {((well.factors.trajectory_score || 0) * 100).toFixed(0)}%</div>
          <div><strong>Parameter Score:</strong> {((well.factors.parameter_score || 0) * 100).toFixed(0)}%</div>
          <div><strong>Event Similarity:</strong> {((well.factors.event_similarity || 0) * 100).toFixed(0)}%</div>
        </div>
      )}
    </div>
  );
};

const RiskCard = ({ risk, currentDepth, wellId, refetch }) => {
  const [showEvidence, setShowEvidence] = useState(false);
  const mutation = useMutation({
    mutationFn: () => risksAPI.evaluate({ well_id: wellId, depth: currentDepth }),
    onSuccess: () => refetch && refetch()
  });

  return (
    <div className="card mb-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'capitalize' }}>
             {risk.risk_type?.replace(/_/g, ' ')}
             <span className={`badge ${getSeverityBadge(risk.risk_level)}`}>{risk.risk_level}</span>
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Score: {((risk.score || 0) * 100).toFixed(0)}% • Depth: {risk.depth_m}m</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Evaluating...' : 'Evaluate Current Context'}
        </button>
      </div>
      <p style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{risk.description}</p>
      
      {risk.evidence && risk.evidence.length > 0 && (
        <div style={{ marginTop: '12px' }}>
           <button className="btn btn-ghost btn-sm" onClick={() => setShowEvidence(!showEvidence)}>
             {showEvidence ? 'Hide Evidence' : 'Show Evidence'}
           </button>
        </div>
      )}
      
      {showEvidence && risk.evidence && (
         <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <EvidencePanel evidence={risk.evidence} />
         </div>
      )}
    </div>
  );
};

export default function WellDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedFormation, setSelectedFormation] = useState(null);
  
  // Event filters
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [fromDepthFilter, setFromDepthFilter] = useState('');
  const [toDepthFilter, setToDepthFilter] = useState('');

  // OVERVIEW DATA
  const { data: dashboardRes, isLoading, error } = useQuery({
    queryKey: ['dashboard', id],
    queryFn: () => dashboardAPI.getWellDashboard(id).then(r => r.data?.data || r.data)
  });

  const dbData = dashboardRes || {};
  const well = dbData.activeWell;
  const currentDepth = dbData.currentState?.depth || well?.current_depth_m;

  // PARAMETERS DATA
  const { data: latestParamsRes } = useQuery({
    queryKey: ['parameters-latest', id],
    queryFn: () => parametersAPI.getLatest(id).then(r => r.data?.data || r.data),
    enabled: activeTab === 'parameters'
  });
  const { data: trendsRes } = useQuery({
    queryKey: ['parameters-trends', id],
    queryFn: () => parametersAPI.getTrends(id).then(r => r.data?.data || r.data),
    enabled: activeTab === 'parameters'
  });

  // FORMATIONS DATA
  const { data: formationsRes } = useQuery({
    queryKey: ['formations', id],
    queryFn: () => formationsAPI.getByWell(id).then(r => r.data?.data || r.data),
    enabled: activeTab === 'formations'
  });

  // EVENTS DATA
  const { data: eventsRes } = useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsAPI.getByWell(id).then(r => r.data?.data || r.data),
    enabled: activeTab === 'events' || activeTab === 'formations'
  });

  // SIMILAR WELLS DATA
  const { data: similarityRes } = useQuery({
    queryKey: ['similar-wells', id],
    queryFn: () => similarityAPI.findSimilar(id).then(r => r.data?.data || r.data),
    enabled: activeTab === 'similar wells' || activeTab === 'formations'
  });

  // RISKS DATA
  const { data: risksRes, refetch: refetchRisks } = useQuery({
    queryKey: ['risks', id],
    queryFn: () => risksAPI.getActive(id).then(r => r.data?.data || r.data),
    enabled: activeTab === 'risks' || activeTab === 'formations'
  });

  // HANDOVER REPORT DATA (Task 2.7b)
  const { data: handoverRes, isLoading: loadingHandover } = useQuery({
    queryKey: ['handover', id],
    queryFn: () => wellsAPI.getHandoverReport(id).then(r => r.data?.data || r.data),
    enabled: activeTab === 'handover'
  });

  if (isLoading) return <LoadingState message="Loading well intelligence..." />;
  if (error || !well) return <ErrorState message="Well not found" />;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: MapPin },
    { key: 'parameters', label: 'Parameters', icon: Activity },
    { key: 'formations', label: 'Formations', icon: Layers },
    { key: 'events', label: 'Events', icon: AlertTriangle },
    { key: 'similar wells', label: 'Similar Wells', icon: ExternalLink },
    { key: 'risks', label: 'Risks', icon: ShieldAlert },
    { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { key: 'handover', label: 'Shift Handover', icon: FileText }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/wells')} id="btn-back-wells">
            <ArrowLeft size={16} /> Back to Wells
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/assistant?wellId=${id}`)}>
            <MessageSquare size={16} /> Ask Assistant
          </button>
        </div>
        <div className="detail-header-main">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MapPin size={24} className="text-gradient" style={{ WebkitTextFillColor: 'unset', color: 'var(--color-accent-cyan)' }} />
              {well.well_name || well.name}
              <span className={`badge ${STATUS_CONFIG[well.status]?.class || 'badge-neutral'}`}>
                {STATUS_CONFIG[well.status]?.label || well.status}
              </span>
            </h1>
            <p className="page-subtitle">{well.field} Field • {well.pad || 'Unknown Pad'} • {well.well_type || 'Development'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/map?focus=${id}`)} id="btn-view-on-map">
              <Layers size={14} /> View on Map
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div className="detail-stat">
          <Ruler size={16} className="detail-stat-icon" />
          <div>
            <div className="stat-value" style={{ fontSize: '1.3rem' }}>
              {(well.total_depth_m || well.total_depth) ? Number(well.total_depth_m || well.total_depth).toLocaleString() : '—'}
            </div>
            <div className="stat-label">Total Depth (m)</div>
          </div>
        </div>
        <div className="detail-stat">
          <Navigation size={16} className="detail-stat-icon" />
          <div>
            <div className="stat-value" style={{ fontSize: '1.3rem' }}>
              {currentDepth != null ? Number(currentDepth).toLocaleString() : '—'}
            </div>
            <div className="stat-label">Current Depth (m)</div>
          </div>
        </div>
        <div className="detail-stat">
          <Clock size={16} className="detail-stat-icon" />
          <div>
            <div className="stat-value" style={{ fontSize: '1.3rem' }}>
              {well.spud_date ? new Date(well.spud_date).toLocaleDateString() : '—'}
            </div>
            <div className="stat-label">Spud Date</div>
          </div>
        </div>
        <div className="detail-stat">
          <MapPin size={16} className="detail-stat-icon" />
          <div>
            <div className="stat-value" style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
              {well.latitude != null ? `${Number(well.latitude).toFixed(4)}°N` : '—'}
            </div>
            <div className="stat-label">Coordinates</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="detail-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`detail-tab ${activeTab === tab.key ? 'detail-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            id={`tab-${tab.key.replace(/\s+/g, '-')}`}
          >
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="detail-content">
        {activeTab === 'overview' && (
          <div className="content-grid content-grid-2">
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Current State</h3>
              <ParameterStrip parameters={dbData.currentState} trends={{}} />
            </div>

            <div className="card">
              <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Well Information</h3>
              <div className="detail-info-grid">
                {[
                  ['Operator', well.operator || 'Oil India Limited'],
                  ['Rig', well.rig || '—'],
                  ['Well Type', well.well_type || '—'],
                  ['Objective', well.objective || '—'],
                  ['Field', well.field || '—'],
                  ['Pad', well.pad || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="detail-info-item">
                    <span className="detail-info-label">{label}</span>
                    <span className="detail-info-value">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Nearby Wells</h3>
              {dbData.nearbyWells?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dbData.nearbyWells.slice(0, 3).map(nw => (
                    <div key={nw.id || nw.well_id} className="nearby-well-item" onClick={() => navigate(`/wells/${nw.id || nw.well_id}`)}>
                      <MapPin size={14} />
                      <span className="nearby-well-name">{nw.well_name || nw.name}</span>
                      {nw.distance_km != null && <span className="nearby-well-dist">{Number(nw.distance_km).toFixed(1)} km</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No nearby wells found.</p>
              )}
            </div>

            <div className="card">
              <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Top Similar Wells</h3>
              {dbData.similarWells?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dbData.similarWells.slice(0, 3).map(sw => (
                    <div key={sw.id || sw.well_id} className="nearby-well-item" onClick={() => navigate(`/wells/${sw.backend_well_id || sw.id || sw.well_id}`)}>
                      <Layers size={14} />
                      <span className="nearby-well-name">{sw.well_name || sw.name}</span>
                      <span className="nearby-well-dist">{((sw.similarity_score || 0) * 100).toFixed(0)}% Match</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No similar wells identified.</p>
              )}
            </div>

            <div className="card">
              <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Active Risks</h3>
              {dbData.activeRisks?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dbData.activeRisks.slice(0, 3).map(risk => (
                    <div key={risk.id} className="nearby-well-item" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 500, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>{risk.risk_type?.replace(/_/g, ' ')}</span>
                      <span className={`badge ${getSeverityBadge(risk.risk_level)}`} style={{ fontSize: '0.7rem' }}>{risk.risk_level}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No active risks.</p>
              )}
            </div>

            <div className="card">
              <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Recent Alerts</h3>
              {dbData.recentAlerts?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dbData.recentAlerts.slice(0, 3).map(alert => (
                    <div key={alert.id} className="nearby-well-item" style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>{alert.alert_type}</span>
                        <span className={`badge ${getSeverityBadge(alert.severity)}`} style={{ fontSize: '0.7rem' }}>{alert.severity}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--color-text-secondary)' }}>{alert.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No recent alerts.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'parameters' && (
          <div className="card">
            <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Latest Parameters</h3>
            {latestParamsRes?.parameter ? (
              <ParameterStrip parameters={latestParamsRes.parameter} trends={trendsRes?.trends ? Object.keys(trendsRes.trends).reduce((acc, key) => ({ ...acc, [key]: trendsRes.trends[key].increasing ? 'increasing' : 'decreasing' }), {}) : {}} />
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No latest parameters available.</p>
            )}

            <h3 className="dash-card-title" style={{ margin: '32px 0 16px' }}>
              <Activity size={16} /> Drilling Parameter Trends
            </h3>
            {trendsRes?.data?.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trendsRes.data.map(d => ({ depth: parseFloat(d.depth), wob: parseFloat(d.wob), rpm: parseFloat(d.rpm), rop: parseFloat(d.rop), torque: parseFloat(d.torque) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,128,185,0.08)" />
                  <XAxis dataKey="depth" tick={{ fill: '#5b6a8a', fontSize: 11 }} label={{ value: 'Depth (m)', position: 'insideBottom', offset: -5, fill: '#5b6a8a' }} />
                  <YAxis tick={{ fill: '#5b6a8a', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1a2036', border: '1px solid rgba(99,128,185,0.12)', borderRadius: 8, color: '#e8ecf4' }} />
                  <Legend />
                  <Line type="monotone" dataKey="rop" stroke="#38bdf8" strokeWidth={2} dot={false} name="ROP (m/hr)" />
                  <Line type="monotone" dataKey="wob" stroke="#6366f1" strokeWidth={2} dot={false} name="WOB (klbs)" />
                  <Line type="monotone" dataKey="rpm" stroke="#34d399" strokeWidth={2} dot={false} name="RPM" />
                  <Line type="monotone" dataKey="torque" stroke="#f59e0b" strokeWidth={2} dot={false} name="Torque" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No trend data available.</p>
            )}
          </div>
        )}

        {activeTab === 'formations' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 className="dash-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} /> Formation Tops & Subsurface Stratigraphy
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  Interactive geological log. Click any horizon to inspect historical events, risk correlations, and regional offset wells.
                </p>
              </div>
              {selectedFormation && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-sidebar-bg, #95562d)', fontWeight: 600 }}>
                    Selected: {selectedFormation.formation_name || selectedFormation.name}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedFormation(null)}
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    Clear Selection
                  </button>
                </div>
              )}
            </div>

            {formationsRes?.formations?.length > 0 ? (
              <>
                <FormationTrack
                  formations={formationsRes.formations}
                  currentDepth={currentDepth}
                  selectedFormation={selectedFormation}
                  onSelectFormation={(form) => setSelectedFormation(form)}
                />

                <FormationDetailDrawer
                  isOpen={!!selectedFormation}
                  formation={selectedFormation}
                  onClose={() => setSelectedFormation(null)}
                  currentDepth={currentDepth}
                  wellEvents={eventsRes?.events || []}
                  wellRisks={risksRes || dbData.activeRisks || []}
                  similarWells={similarityRes?.similar_wells || []}
                />
              </>
            ) : (
              <EmptyState title="No Formations" message="No formation data available for this well." />
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="dash-card-title" style={{ margin: 0 }}>
                <AlertTriangle size={16} /> Drilling Events
              </h3>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <select className="input-field" value={eventTypeFilter} onChange={e => setEventTypeFilter(e.target.value)}>
                <option value="">All Event Types</option>
                <option value="stuck_pipe">Stuck Pipe</option>
                <option value="lost_circulation">Lost Circulation</option>
                <option value="kick">Kick</option>
                <option value="wellbore_instability">Wellbore Instability</option>
              </select>
              <select className="input-field" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                <option value="">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MODERATE">Moderate</option>
                <option value="LOW">Low</option>
              </select>
              <input type="number" className="input-field" placeholder="Depth From (m)" value={fromDepthFilter} onChange={e => setFromDepthFilter(e.target.value)} />
              <input type="number" className="input-field" placeholder="Depth To (m)" value={toDepthFilter} onChange={e => setToDepthFilter(e.target.value)} />
            </div>

            {eventsRes?.events?.length > 0 ? (
              <EventTimeline 
                events={eventsRes.events} 
                onSelectEvent={evt => setSelectedEvent(evt)} 
                eventTypeFilter={eventTypeFilter}
                severityFilter={severityFilter}
                fromDepthFilter={fromDepthFilter ? parseFloat(fromDepthFilter) : undefined}
                toDepthFilter={toDepthFilter ? parseFloat(toDepthFilter) : undefined}
              />
            ) : (
              <EmptyState title="No Events" message="No events recorded for this well." />
            )}
            
            <EventDetailDrawer isOpen={!!selectedEvent} event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </div>
        )}

        {activeTab === 'similar wells' && (
          <div>
            <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Similar Wells Analysis</h3>
            {similarityRes?.similar_wells?.length > 0 ? (
              similarityRes.similar_wells.map(sw => (
                <SimilarWellCard key={sw.id || sw.well_id} well={sw} />
              ))
            ) : (
              <EmptyState title="No Similar Wells" message="No similar wells could be found based on current analysis." />
            )}
          </div>
        )}

        {activeTab === 'risks' && (
          <div>
            <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Active Risks</h3>
            {risksRes && risksRes.length > 0 ? (
              risksRes.map(risk => (
                <RiskCard key={risk.id} risk={risk} currentDepth={currentDepth} wellId={id} refetch={refetchRisks} />
              ))
            ) : (
              <EmptyState title="No Active Risks" message="No critical or high risks currently active." />
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div>
            <h3 className="dash-card-title" style={{ marginBottom: '16px' }}>Real-time Alerts</h3>
            <AlertPanel wellId={id} />
          </div>
        )}

        {activeTab === 'handover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Handover Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 className="dash-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} style={{ color: 'var(--color-sidebar-bg)' }} />
                  Shift Handover Report & Operational Transfer
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  Auto-compiled operational status for tour change and engineering sign-off
                </p>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> Print / Export Handover (PDF)
              </button>
            </div>

            {loadingHandover ? (
              <LoadingState message="Compiling shift handover dossier..." />
            ) : !handoverRes ? (
              <ErrorState message="Could not compile handover dossier." />
            ) : (
              <div className="card" style={{ padding: '28px', border: '1px solid var(--color-border)', backgroundColor: '#fff' }}>
                {/* Official Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Oil India Limited / ONGC &middot; eRTMAC Real-time Operations
                    </div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                      DRILLING SHIFT HANDOVER REPORT
                    </h2>
                    <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                      Well: <strong>{handoverRes.well?.well_name}</strong> &middot; Field: <strong>{handoverRes.well?.field}</strong> &middot; Status: <span style={{ textTransform: 'capitalize' }}>{handoverRes.well?.status}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#475569' }}>
                    <div><strong>Date:</strong> {handoverRes.shift_date}</div>
                    <div><strong>Time:</strong> {handoverRes.shift_time} hrs IST</div>
                    <div><strong>Generated:</strong> {new Date(handoverRes.generated_at).toLocaleTimeString()}</div>
                  </div>
                </div>

                {/* Section 1: Telemetry Snapshot */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                    1. Real-time Telemetry Snapshot at Shift Handover
                  </h4>
                  {handoverRes.current_parameters ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                      <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Bit Depth</span>
                        <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{handoverRes.current_parameters.depth} m</strong>
                      </div>
                      <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>WOB</span>
                        <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{handoverRes.current_parameters.wob} kN</strong>
                      </div>
                      <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Torque</span>
                        <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{handoverRes.current_parameters.torque} kNm</strong>
                      </div>
                      <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>ROP</span>
                        <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{handoverRes.current_parameters.rop} m/hr</strong>
                      </div>
                      <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>SPP</span>
                        <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{handoverRes.current_parameters.standpipe_pressure} bar</strong>
                      </div>
                      <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Mud Weight</span>
                        <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{handoverRes.current_parameters.mud_weight} sg</strong>
                      </div>
                      <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Hook Load</span>
                        <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{handoverRes.current_parameters.hook_load} kN</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>No telemetry data recorded for this well.</div>
                  )}
                </div>

                {/* Section 2: Open Alerts */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                    2. Active Unresolved Alerts ({handoverRes.open_alerts?.length || 0})
                  </h4>
                  {handoverRes.open_alerts && handoverRes.open_alerts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {handoverRes.open_alerts.map((alert) => (
                        <div key={alert.id} style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: alert.severity === 'critical' ? '#fef2f2' : alert.severity === 'high' ? '#fffbeb' : '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.82rem' }}>
                          <div>
                            <span style={{ fontWeight: 700, textTransform: 'uppercase', color: alert.severity === 'critical' ? '#b91c1c' : alert.severity === 'high' ? '#b45309' : '#0f172a', marginRight: '8px' }}>
                              [{alert.severity}] {alert.risk_type?.replace(/_/g, ' ')}
                            </span>
                            <span style={{ color: '#334155' }}>{alert.message}</span>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                              Depth: {alert.first_seen_depth}m &rarr; {alert.last_seen_depth}m &middot; Occurrences: {alert.occurrence_count} &middot; Score: {alert.score ? Math.round(alert.score * 100) + '%' : 'N/A'}
                            </div>
                          </div>
                          <div>
                            {alert.acknowledged_by ? (
                              <span style={{ color: '#059669', fontSize: '0.74rem', fontWeight: 600 }}>
                                &check; Acknowledged by {alert.acknowledged_by}
                              </span>
                            ) : (
                              <span style={{ color: '#dc2626', fontSize: '0.74rem', fontWeight: 600 }}>
                                &bull; Unacknowledged
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 500 }}>
                      &check; Zero open critical or high alerts at shift close.
                    </div>
                  )}
                </div>

                {/* Section 3: Recent Events & Active Risks */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                      3. Recent Drilling Events Logged ({handoverRes.recent_events?.length || 0})
                    </h4>
                    {handoverRes.recent_events && handoverRes.recent_events.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {handoverRes.recent_events.map((e) => (
                          <div key={e.id} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {e.event_type?.replace(/_/g, ' ')} at {e.depth}m ({e.formation || 'Subsurface'})
                            </div>
                            <div style={{ color: '#475569', marginTop: '2px' }}>{e.description}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.82rem' }}>No recent drilling events recorded.</div>
                    )}
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px' }}>
                      4. Proactive AI Risk Prognosis ({handoverRes.active_risks?.length || 0})
                    </h4>
                    {handoverRes.active_risks && handoverRes.active_risks.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {handoverRes.active_risks.slice(0, 4).map((r) => (
                          <div key={r.id} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.78rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{r.risk_type?.replace(/_/g, ' ')}</span>
                              <span style={{ fontWeight: 700, color: r.score >= 0.7 ? '#dc2626' : '#d97706' }}>
                                Score: {Math.round((r.score || 0) * 100)}%
                              </span>
                            </div>
                            <div style={{ color: '#475569', marginTop: '2px', fontSize: '0.74rem' }}>{r.explanation}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.82rem' }}>No active risk predictions.</div>
                    )}
                  </div>
                </div>

                {/* Section 4: Sign-off & Disclaimer */}
                <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ maxWidth: '480px', fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 }}>
                    <strong>Notice:</strong> {handoverRes.disclaimer}
                  </div>

                  <div style={{ display: 'flex', gap: '32px', fontSize: '0.78rem', color: '#334155' }}>
                    <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '6px', minWidth: '130px' }}>
                      Outgoing Tour Engineer
                    </div>
                    <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '6px', minWidth: '130px' }}>
                      Incoming Tour Engineer
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </motion.div>
  );
}
