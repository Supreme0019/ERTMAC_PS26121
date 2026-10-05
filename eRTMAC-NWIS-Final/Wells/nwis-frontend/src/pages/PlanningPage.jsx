// =============================================================================
// NWIS Frontend — Pre-Spud Well Planning & Subsurface Hazard Assessment
// =============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapContainer, TileLayer, Marker, Popup, Circle, Polygon, 
  Tooltip as LeafletTooltip, useMap, useMapEvents 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { planningAPI, wellsAPI } from '../api/client';
import { 
  Compass, MapPin, Layers, AlertTriangle, ShieldAlert, CheckCircle2, 
  ChevronRight, Activity, Download, Printer, RefreshCw, Loader2, 
  Sliders, Info, FileSpreadsheet, Eye, X, Check, Target, Droplets, Zap
} from 'lucide-react';

import './PlanningPage.css';

// Fix standard Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Proposed Target Pin Icon
const createTargetIcon = () => {
  const html = `
    <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: #dc2626; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 22px; height: 22px; border-radius: 50%; background: #991b1b; border: 3px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px;">
        ✦
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-target-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17]
  });
};

// Custom Offset Well Marker Icon
const createOffsetWellIcon = () => {
  const html = `
    <div style="width: 14px; height: 14px; border-radius: 50%; background: #3b82f6; border: 2px solid #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></div>
  `;
  return L.divIcon({
    html,
    className: 'custom-offset-marker',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -7]
  });
};

// Click-to-Pin Handler Component
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
    }
  });
  return null;
}

// Map Center & Zoom Controller
function MapViewController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1 });
  }, [center, zoom, map]);
  return null;
}

// Preset Targets in Upper Assam
const PRESETS = [
  { name: 'Lakwa Infill (LKW-PML)', lat: 26.7800, lon: 94.2100, depth: 3200, formation: 'kopili' },
  { name: 'Rudrasagar Step-Out', lat: 26.8050, lon: 94.1900, depth: 3400, formation: 'barail' },
  { name: 'Geleki Deep Target', lat: 26.7500, lon: 94.1700, depth: 3500, formation: 'sylhet' },
  { name: 'Naharkatiya Appraisal', lat: 27.2800, lon: 95.3400, depth: 3000, formation: 'barail' },
  { name: 'Digboi Flank Prospect', lat: 27.3900, lon: 95.6200, depth: 2400, formation: 'tipam' }
];

export default function PlanningPage() {
  // Inputs
  const [wellName, setWellName] = useState('LKW-PROP-01');
  const [latitude, setLatitude] = useState(26.7800);
  const [longitude, setLongitude] = useState(94.2100);
  const [targetDepth, setTargetDepth] = useState(3250);
  const [radiusKm, setRadiusKm] = useState(25);
  const [wellType, setWellType] = useState('development');
  const [targetFormation, setTargetFormation] = useState('kopili');

  // Map settings
  const [mapBase, setMapBase] = useState('street'); // 'street' or 'satellite'
  const [showDghBlocks, setShowDghBlocks] = useState(true);

  // Data states
  const [blocks, setBlocks] = useState([]);
  const [existingWells, setExistingWells] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [dossierOpen, setDossierOpen] = useState(false);

  // 1. Load initial DGH blocks and existing wells
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [blocksRes, wellsRes] = await Promise.all([
          planningAPI.getBlocks(),
          wellsAPI.getAll({ limit: 50 })
        ]);
        setBlocks(blocksRes.data?.data?.blocks || []);
        const wList = wellsRes.data?.data?.wells || wellsRes.data?.data || [];
        setExistingWells(wList);
      } catch (err) {
        console.error('Failed to load initial planning data:', err);
      }
    }
    loadInitialData();
  }, []);

  // 2. Automatically evaluate location on load or change
  useEffect(() => {
    handleEvaluate();
  }, [radiusKm, targetFormation]);

  async function handleEvaluate() {
    setEvaluating(true);
    setErrorMsg(null);
    try {
      const { data } = await planningAPI.evaluate({
        latitude,
        longitude,
        target_depth: targetDepth,
        radius_km: radiusKm,
        well_type: wellType,
        target_formation: targetFormation
      });
      setEvaluation(data.data);
    } catch (err) {
      console.error('Evaluation failed:', err);
      setErrorMsg(err.response?.data?.error?.message || 'Failed to evaluate subsurface planning parameters.');
    } finally {
      setEvaluating(false);
    }
  }

  const handleApplyPreset = (p) => {
    setLatitude(p.lat);
    setLongitude(p.lon);
    setTargetDepth(p.depth);
    setTargetFormation(p.formation);
    setWellName(`PROP-${p.name.slice(0, 7).toUpperCase().replace(/\s+/g, '-')}`);
  };

  const handleLocationSelect = (lat, lon) => {
    setLatitude(lat);
    setLongitude(lon);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="planning-container">
      {/* Page Header */}
      <div className="planning-header">
        <div>
          <h1 className="planning-title">Pre-Spud Well Planning & Subsurface Hazard Prognosis</h1>
          <p className="planning-subtitle">
            Set target coordinates or click on the interactive basin map to resolve DGH petroleum blocks, 
            generate stratigraphic column prognoses, and cross-correlate historical subsurface hazards across offset wells.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setDossierOpen(true)}
            disabled={!evaluation}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} /> Export DGH Dossier
          </button>

          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleEvaluate}
            disabled={evaluating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {evaluating ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
            {evaluating ? 'Analyzing Subsurface...' : 'Evaluate Location'}
          </button>
        </div>
      </div>

      {/* Preset Quick Jumps */}
      <div className="preset-bar">
        <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Target size={14} /> Quick Exploration Targets:
        </span>
        {PRESETS.map((p, idx) => (
          <button 
            key={idx} 
            className="preset-btn"
            onClick={() => handleApplyPreset(p)}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Top Section: Map & Input Controls */}
      <div className="planning-grid">
        {/* Interactive Map Card */}
        <div className="planning-map-card">
          <div className="planning-map-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: 'var(--color-sidebar-bg)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-heading)' }}>
                Assam-Arakan Basin GIS & DGH Acreage Overlay
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button 
                className={`btn btn-xs ${showDghBlocks ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShowDghBlocks(!showDghBlocks)}
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                DGH Blocks: {showDghBlocks ? 'ON' : 'OFF'}
              </button>
              <button 
                className={`btn btn-xs ${mapBase === 'street' ? 'btn-ghost' : 'btn-secondary'}`}
                onClick={() => setMapBase(mapBase === 'street' ? 'satellite' : 'street')}
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                {mapBase === 'street' ? 'Imagery' : 'Streets'}
              </button>
            </div>
          </div>

          <div className="planning-map-view">
            <MapContainer 
              center={[latitude, longitude]} 
              zoom={11} 
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              {mapBase === 'street' ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}

              <MapClickHandler onLocationSelect={handleLocationSelect} />
              <MapViewController center={[latitude, longitude]} zoom={11} />

              {/* DGH Block Polygons */}
              {showDghBlocks && blocks.map((block) => (
                <Polygon
                  key={block.id}
                  positions={block.coordinates}
                  pathOptions={{
                    color: block.id.includes('lkw') ? '#f59e0b' : (block.id.includes('nhk') ? '#10b981' : '#64748b'),
                    weight: 2,
                    fillOpacity: 0.12,
                    dashArray: '4 4'
                  }}
                >
                  <LeafletTooltip sticky>
                    <div style={{ fontSize: '0.78rem' }}>
                      <strong>{block.name}</strong><br/>
                      <span style={{ color: '#64748b' }}>{block.lease_type}</span><br/>
                      <span>Operator: {block.operator}</span><br/>
                      <span style={{ color: '#9ca3af', fontSize: '0.7rem', fontStyle: 'italic' }}>Boundary approximate, illustrative</span>
                    </div>
                  </LeafletTooltip>
                </Polygon>
              ))}

              {/* Offset Radius Circle */}
              <Circle
                center={[latitude, longitude]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#991b1b',
                  fillColor: '#ef4444',
                  fillOpacity: 0.08,
                  weight: 1.5,
                  dashArray: '6 6'
                }}
              />

              {/* Offset Wells */}
              {existingWells.map((w) => {
                const wLat = parseFloat(w.latitude);
                const wLon = parseFloat(w.longitude);
                if (isNaN(wLat) || isNaN(wLon)) return null;
                return (
                  <Marker
                    key={w.id}
                    position={[wLat, wLon]}
                    icon={createOffsetWellIcon()}
                  >
                    <Popup>
                      <div style={{ fontSize: '0.8rem', padding: '2px' }}>
                        <strong>{w.well_name}</strong><br/>
                        <span style={{ color: '#64748b' }}>{w.field} ({w.status})</span><br/>
                        <span>Depth: {w.current_depth || w.total_depth || '—'} m</span>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Target Well Marker (Draggable) */}
              <Marker
                position={[latitude, longitude]}
                icon={createTargetIcon()}
                draggable={true}
                eventHandlers={{
                  dragend(e) {
                    const { lat, lng } = e.target.getLatLng();
                    setLatitude(Number(lat.toFixed(4)));
                    setLongitude(Number(lng.toFixed(4)));
                  }
                }}
              >
                <Popup>
                  <div style={{ fontSize: '0.82rem' }}>
                    <strong>Proposed Well: {wellName}</strong><br/>
                    <span>Target Depth: {targetDepth} m</span><br/>
                    <span style={{ color: '#991b1b', fontWeight: 600 }}>Drag marker to reposition</span>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>

            {/* Coordinates overlay badge */}
            <div className="map-coords-badge">
              <MapPin size={13} style={{ color: '#ef4444' }} />
              <span>Target: {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E</span>
              <span>•</span>
              <span style={{ color: '#cbd5e1' }}>Radius: {radiusKm} km</span>
            </div>
          </div>
        </div>

        {/* Input Parameters Form Card */}
        <div className="planning-form-card">
          <div style={{ borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--color-text-heading)' }}>
              Subsurface Target Specifications
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
              Define planned trajectory depth, regulatory classification, and objective formation.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group-custom">
              <label>Proposed Well Identifier</label>
              <input 
                type="text" 
                className="input" 
                value={wellName} 
                onChange={(e) => setWellName(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <div className="form-group-custom">
              <label>Well Classification (DGH)</label>
              <select 
                className="input" 
                value={wellType} 
                onChange={(e) => setWellType(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="development">Development / Infill</option>
                <option value="exploratory">Exploratory / Wildcat</option>
                <option value="appraisal">Appraisal / Step-Out</option>
                <option value="re-entry">Re-Entry / Deepening</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group-custom">
              <label>Target Latitude (°N)</label>
              <input 
                type="number" 
                step="0.0001" 
                className="input" 
                value={latitude} 
                onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div className="form-group-custom">
              <label>Target Longitude (°E)</label>
              <input 
                type="number" 
                step="0.0001" 
                className="input" 
                value={longitude} 
                onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          <div className="form-group-custom">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Planned Target Depth (TD)</label>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-sidebar-bg)', fontSize: '0.88rem' }}>
                {targetDepth.toLocaleString()} m
              </span>
            </div>
            <input 
              type="range" 
              min="1000" 
              max="4500" 
              step="50" 
              value={targetDepth} 
              onChange={(e) => setTargetDepth(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-sidebar-bg)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group-custom">
              <label>Target Geological Horizon</label>
              <select 
                className="input" 
                value={targetFormation} 
                onChange={(e) => setTargetFormation(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="tipam">Tipam Sandstone (Upper Reservoir)</option>
                <option value="barail">Barail Series (Main Pay)</option>
                <option value="kopili">Kopili Formation (Deep Target)</option>
                <option value="sylhet">Sylhet Limestone (Basement Contact)</option>
              </select>
            </div>

            <div className="form-group-custom">
              <label>Offset Proximity Radius</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {[5, 10, 15, 25].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadiusKm(r)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 'fit-content',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: radiusKm === r ? 'none' : '1px solid transparent',
                      backgroundColor: radiusKm === r ? '#5C4033' : 'transparent',
                      color: radiusKm === r ? '#FFFFFF' : '#4B3728',
                      fontWeight: radiusKm === r ? 600 : 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease, color 0.15s ease',
                      fontFamily: 'inherit',
                      lineHeight: '1.2',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (radiusKm !== r) e.currentTarget.style.backgroundColor = '#F3EDE3'; }}
                    onMouseLeave={e => { if (radiusKm !== r) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {r}km
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button 
            className="btn btn-primary"
            onClick={handleEvaluate}
            disabled={evaluating}
            style={{ marginTop: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {evaluating ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
            {evaluating ? 'Computing Offset Hazard Correlation...' : 'Evaluate Subsurface Hazards'}
          </button>
        </div>
      </div>

      {/* DGH Concession & Administrative Intelligence Strip */}
      {evaluation && (
        <div className="dgh-strip">
          <div className="dgh-kpi-item">
            <span className="dgh-kpi-label">Sedimentary Basin (DGH)</span>
            <span className="dgh-kpi-val">{evaluation.location.basin}</span>
          </div>

          <div className="dgh-kpi-item">
            <span className="dgh-kpi-label">Concession / PML Block</span>
            <span className="dgh-kpi-val" style={{ color: 'var(--color-sidebar-bg)' }}>
              {evaluation.location.block_name}
            </span>
          </div>

          <div className="dgh-kpi-item">
            <span className="dgh-kpi-label">Operating Authority</span>
            <span className="dgh-kpi-val">{evaluation.location.operator}</span>
          </div>

          <div className="dgh-kpi-item">
            <span className="dgh-kpi-label">State / Administrative District</span>
            <span className="dgh-kpi-val">{evaluation.location.state} ({evaluation.location.district})</span>
          </div>

          <div className="dgh-kpi-item">
            <span className="dgh-kpi-label">Correlated Offset Wells</span>
            <span className="dgh-kpi-val" style={{ color: '#0284c7' }}>
              {evaluation.offset_summary.total_wells_in_radius} Wells ({evaluation.offset_summary.total_historical_events_found} Events)
            </span>
          </div>
        </div>
      )}

      {/* Forecasted Stratigraphic Column */}
      {evaluation && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--color-sidebar-bg)' }} />
                Forecasted Stratigraphic Column (Depth Prognosis to {targetDepth} m)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                Inferred from {evaluation.offset_summary.total_wells_in_radius} offset wells using distance-weighted geological horizon interpolation.
              </p>
            </div>
            <span className="badge badge-success" style={{ fontSize: '0.74rem' }}>
              Upper Assam Shelf Standard
            </span>
          </div>

          <div className="stratigraphy-track">
            {evaluation.stratigraphy_prognosis.map((strat, idx) => (
              <div 
                key={idx} 
                className={`stratum-row ${strat.is_target ? 'target-stratum' : ''}`}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.86rem', color: strat.is_target ? 'var(--color-sidebar-bg)' : 'var(--color-text-primary)' }}>
                    {strat.formation}
                  </span>
                  {strat.is_target && (
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '1px 5px', width: 'fit-content', marginTop: '2px' }}>
                      Primary Target
                    </span>
                  )}
                </div>

                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
                  {strat.lithology}
                </div>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>
                  <strong>{strat.top_depth} m</strong> &mdash; <strong>{strat.bottom_depth} m</strong>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.74rem', marginLeft: '6px' }}>
                    ({strat.thickness_m} m)
                  </span>
                </div>

                <div style={{ textAlign: 'right', fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                  {strat.age}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Depth-Wise Historical Hazard Profiler */}
      {evaluation && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--color-text-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} style={{ color: '#ef4444' }} />
                Depth-Wise Historical Hazard Profiler ({radiusKm}-km Proximity Cluster)
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: '4px 0 0 0' }}>
                Subsurface incidents previously encountered at corresponding depths in offset wells with recorded field mitigations.
              </p>
            </div>
            <span className="badge badge-danger" style={{ fontSize: '0.74rem' }}>
              Historical Incident Matrix
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {evaluation.depth_hazards.map((haz, idx) => {
              const sevClass = `sev-${haz.severity}`;
              return (
                <div key={idx} className={`hazard-interval-card ${sevClass}`}>
                  {/* Interval Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-text-heading)' }}>
                        {haz.depth_interval}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        • {haz.formation}
                      </span>
                      <span 
                        className={`badge ${haz.severity === 'critical' ? 'badge-danger' : (haz.severity === 'high' ? 'badge-warning' : (haz.severity === 'medium' ? 'badge-warning' : 'badge-neutral'))}`}
                        style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}
                      >
                        {haz.severity} Risk
                      </span>
                    </div>

                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: haz.total_offset_incidents > 0 ? '#dc2626' : 'var(--color-text-muted)' }}>
                      {haz.total_offset_incidents} Historical Offset Incidents
                    </span>
                  </div>

                  {/* Primary Concern & Engineering Precaution */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', fontSize: '0.8rem' }}>
                    <div style={{ backgroundColor: 'var(--color-bg-primary)', padding: '8px 12px', borderRadius: '4px' }}>
                      <strong style={{ color: 'var(--color-sidebar-bg)' }}>Identified Geological Concern:</strong>
                      <p style={{ margin: '2px 0 0 0', color: 'var(--color-text-secondary)' }}>{haz.primary_concern}</p>
                    </div>

                    <div style={{ backgroundColor: 'rgba(52, 211, 153, 0.08)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                      <strong style={{ color: 'var(--color-accent-emerald)' }}>Pre-Spud Engineering Precaution:</strong>
                      <p style={{ margin: '2px 0 0 0', color: 'var(--color-text-primary)' }}>{haz.engineering_precaution}</p>
                    </div>
                  </div>

                  {/* Recorded offset incidents list */}
                  {haz.recorded_events.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Recorded Offset Incidents & Applied Mitigations:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {haz.recorded_events.map((ev, eIdx) => (
                          <div key={eIdx} className="recorded-event-pill">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <span style={{ fontWeight: 700, color: '#991b1b' }}>
                                {ev.well_name} ({ev.distance_km ? `${ev.distance_km} km away` : 'Offset'}) &mdash; @{ev.depth} m
                              </span>
                              <span style={{ textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 600, color: '#dc2626' }}>
                                {ev.event_type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <div style={{ color: 'var(--color-text-secondary)' }}>{ev.description}</div>
                            {ev.mitigation && (
                              <div style={{ marginTop: '3px', fontSize: '0.74rem', color: 'var(--color-accent-emerald)', fontWeight: 500 }}>
                                <strong>Mitigation:</strong> {ev.mitigation} {ev.outcome ? `(${ev.outcome})` : ''}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pre-Spud Engineering Program Recommendations */}
      {evaluation && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '10px 16px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '6px' }}>
            <Info size={16} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#92400e' }}>Generic offset-informed template — not a drilling program</span>
              <span style={{ fontSize: '0.78rem', color: '#78350f', marginLeft: '8px' }}>These recommendations derive from offset well statistics. A certified drilling programme must be prepared by a licensed drilling engineer before spud.</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
          {/* Mud Weight Program */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--color-text-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Droplets size={16} style={{ color: '#0284c7' }} />
              Recommended Mud Weight & Chemistry Window
            </h3>
            <table className="eng-table">
              <thead>
                <tr>
                  <th>Depth Interval</th>
                  <th>Fluid System</th>
                  <th>Density (sg)</th>
                  <th>Primary Function</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.engineering_program.recommended_mud_program.map((m, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{m.depth_range}</td>
                    <td>{m.fluid_type}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-sidebar-bg)', fontWeight: 700 }}>{m.recommended_density_sg}</td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>{m.objective}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Casing Seat Scheme */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--color-text-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={16} style={{ color: '#f59e0b' }} />
              Recommended Casing Scheme & Setting Depths
            </h3>
            <table className="eng-table">
              <thead>
                <tr>
                  <th>Casing String</th>
                  <th>OD Size</th>
                  <th>Setting Depth</th>
                  <th>Engineering Purpose</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.engineering_program.casing_seat_recommendations.map((c, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{c.string}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{c.size_in}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-sidebar-bg)' }}>{c.recommended_depth_m} m</td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)' }}>{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* DGH Pre-Spud Dossier Modal (Printable) */}
      <AnimatePresence>
        {dossierOpen && evaluation && (
          <div className="dossier-modal-backdrop" onClick={() => setDossierOpen(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="dossier-modal" 
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={18} style={{ color: '#0f172a' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                    DIRECTORATE GENERAL OF HYDROCARBONS &mdash; FORM DGH-WR-01
                  </span>
                </div>
                <div className="dossier-modal-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => window.print()}>
                    <Printer size={13} /> Print Dossier
                  </button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setDossierOpen(false)}>
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div className="dossier-modal-body">
                {/* Official Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', color: '#64748b' }}>
                    GOVERNMENT OF INDIA &bull; MINISTRY OF PETROLEUM & NATURAL GAS
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0', color: '#0f172a' }}>
                    DIRECTORATE GENERAL OF HYDROCARBONS (DGH)
                  </h2>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    GEOLOGICAL WELL PROGNOSIS & PRE-SPUD HAZARD APPRAISAL DOSSIER
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    Concession: {evaluation.location.block_name} &bull; Generated via eRTMAC-NWIS Intelligent Subsurface Engine
                  </div>
                </div>

                {/* Section A: Administrative */}
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', textTransform: 'uppercase' }}>
                  I. Well Location & Administrative Concession
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
                  <div><strong>Proposed Well Name:</strong> {wellName}</div>
                  <div><strong>Concession/Lease:</strong> {evaluation.location.block_name} ({evaluation.location.lease_type})</div>
                  <div><strong>Surface Coordinates:</strong> {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E</div>
                  <div><strong>Sedimentary Basin:</strong> {evaluation.location.basin}</div>
                  <div><strong>Planned Total Depth (TD):</strong> {targetDepth} m</div>
                  <div><strong>Operating Concessionaire:</strong> {evaluation.location.operator}</div>
                </div>

                {/* Section B: Stratigraphic Forecast */}
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', textTransform: 'uppercase' }}>
                  II. Forecasted Stratigraphic Succession
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Formation / Group</th>
                      <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Lithology Description</th>
                      <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Top Depth</th>
                      <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Base Depth</th>
                      <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Thickness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluation.stratigraphy_prognosis.map((s, idx) => (
                      <tr key={idx}>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px', fontWeight: s.is_target ? 700 : 400 }}>
                          {s.formation} {s.is_target ? '(Target Pay)' : ''}
                        </td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{s.lithology}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px', fontFamily: 'monospace' }}>{s.top_depth} m</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px', fontFamily: 'monospace' }}>{s.bottom_depth} m</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px', fontFamily: 'monospace' }}>{s.thickness_m} m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Section C: Subsurface Hazard Analysis */}
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', textTransform: 'uppercase' }}>
                  III. Offset Subsurface Hazards Review ({radiusKm}-km Radius)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {evaluation.depth_hazards.map((h, idx) => (
                    <div key={idx} style={{ border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '4px', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{h.depth_interval} &mdash; {h.formation}</strong>
                        <span style={{ fontWeight: 700, color: h.severity === 'critical' ? '#dc2626' : '#d97706', textTransform: 'uppercase' }}>
                          {h.severity} RISK ({h.total_offset_incidents} offset events)
                        </span>
                      </div>
                      <div style={{ color: '#475569', marginTop: '2px' }}>
                        <em>Precaution:</em> {h.engineering_precaution}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sign-off Blocks */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '40px', paddingTop: '20px', borderTop: '1px dashed #cbd5e1', textAlign: 'center', fontSize: '0.75rem' }}>
                  <div>
                    <div style={{ height: '35px' }}></div>
                    <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 600 }}>
                      Senior Geologist (OIL)
                    </div>
                  </div>
                  <div>
                    <div style={{ height: '35px' }}></div>
                    <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 600 }}>
                      Drilling Superintendent (OIL)
                    </div>
                  </div>
                  <div>
                    <div style={{ height: '35px' }}></div>
                    <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 600 }}>
                      DGH Technical Inspector
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
