import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import { Layers, Activity, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { wellsAPI } from '../api/client';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { Drawer } from '../components/ui/Drawer';
import ActiveWellContextBar from '../components/wells/ActiveWellContextBar';

import './MapPage.css';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons
const createWellIcon = (isActive = false, isNearby = false) => {
  let color = '#8b99b8'; // Default grey
  if (isActive) color = '#ef4444'; // Red for active
  else if (isNearby) color = '#38bdf8'; // Blue for nearby

  const size = isActive ? 24 : 16;
  const pulse = isActive ? `<div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${color}; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : '';
  
  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
      ${pulse}
      <div style="width: ${isActive ? size * 0.6 : size}px; height: ${isActive ? size * 0.6 : size}px; border-radius: 50%; background: ${color}; border: 2px solid #1e293b; z-index: 1;"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-well-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

function MapBoundsHandler({ activeWell, radiusKm }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (activeWell && !isNaN(Number(activeWell.latitude)) && !isNaN(Number(activeWell.longitude))) {
      const lat = Number(activeWell.latitude);
      const lng = Number(activeWell.longitude);
      const deg = radiusKm / 111;
      map.fitBounds([[lat - deg, lng - deg], [lat + deg, lng + deg]], { padding: [50, 50] });
    }
  }, [activeWell, radiusKm, map]);
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialWellId = searchParams.get('well') || 'b1000000-0000-0000-0000-000000000001';

  const [activeWellId, setActiveWellId] = useState(initialWellId);
  const [radiusKm, setRadiusKm] = useState(10);
  const [mapStyle, setMapStyle] = useState('dark');
  const [selectedNearbyWell, setSelectedNearbyWell] = useState(null);
  const [showIntelligencePanel, setShowIntelligencePanel] = useState(false);

  // All wells query
  const { data: allWellsData, isLoading: loadingAll } = useQuery({
    queryKey: ['wells', 'all'],
    queryFn: () => wellsAPI.getAll({ limit: 200 })
  });
  
  const wellsList = useMemo(() => allWellsData?.data?.data?.wells || [], [allWellsData]);
  const activeWell = useMemo(() => {
    return wellsList.find(w => w.id === activeWellId) || wellsList[0] || null;
  }, [wellsList, activeWellId]);

  useEffect(() => {
    if (activeWell && !activeWellId) {
      setActiveWellId(activeWell.id);
    }
  }, [activeWell, activeWellId]);

  // Nearby wells query with PostGIS spatial calculation
  const { data: nearbyData, isLoading: loadingNearby, isError: errorNearby } = useQuery({
    queryKey: ['wells', 'nearby', activeWellId, radiusKm],
    queryFn: () => wellsAPI.nearbyByWell(activeWellId, { radius: radiusKm }),
    enabled: !!activeWellId
  });

  const nearbyWells = useMemo(() => {
    const list = nearbyData?.data?.data?.nearby_wells || nearbyData?.data?.nearby_wells;
    if (Array.isArray(list)) return list;
    if (Array.isArray(nearbyData?.data)) return nearbyData.data;
    return [];
  }, [nearbyData]);

  const handleNearbyClick = (well) => {
    setSelectedNearbyWell(well);
    setShowIntelligencePanel(true);
  };

  const tiles = {
    dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    streets: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="map-page" 
      style={{ 
        position: 'relative', 
        width: '100%', 
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg-primary, #f6f1ea)'
      }}
    >
      
      {/* Top Context Bar */}
      {activeWell && (
        <ActiveWellContextBar 
          wellName={activeWell.well_name}
          depth={activeWell.current_depth || activeWell.depth || 2860}
          formation={activeWell.current_formation || activeWell.formation || 'Kopili Formation'}
          status={activeWell.status === 'active' || activeWell.status === 'LIVE' ? 'LIVE' : activeWell.status || 'Active'}
        />
      )}

      {/* Dedicated Distinct Controls Section (No Overlap) */}
      <div 
        style={{ 
          padding: '10px 24px', 
          backgroundColor: '#0f172a', 
          borderBottom: '1px solid #1e293b', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          position: 'sticky',
          top: '112px',
          zIndex: 10,
          flexShrink: 0
        }}
      >
        {/* Left: Active Well & Radius Selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>Active Well:</span>
            <select 
              value={activeWellId} 
              onChange={e => { setActiveWellId(e.target.value); setSelectedNearbyWell(null); setShowIntelligencePanel(false); }}
              style={{ 
                background: '#1e293b', 
                border: '1px solid #334155', 
                color: '#f8fafc', 
                padding: '6px 12px', 
                borderRadius: '6px', 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                outline: 'none', 
                cursor: 'pointer' 
              }}
            >
              {loadingAll ? <option>Loading wells...</option> : wellsList.map(w => (
                <option key={w.id} value={w.id}>{w.well_name}</option>
              ))}
            </select>
          </div>

          <div style={{ width: '1px', height: '22px', background: '#334155' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>Radius:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[5, 10, 15, 20, 25].map(r => (
                <button
                  key={r}
                  onClick={() => setRadiusKm(r)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    borderRadius: '5px',
                    border: '1px solid ' + (radiusKm === r ? '#0284c7' : '#334155'),
                    background: radiusKm === r ? '#0284c7' : '#1e293b',
                    color: radiusKm === r ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: radiusKm === r ? 700 : 500,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {r}km
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Map Layers & Offset Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>Layer:</span>
            <div style={{ display: 'flex', gap: '4px', background: '#1e293b', padding: '3px', borderRadius: '6px', border: '1px solid #334155' }}>
              {['dark', 'satellite', 'terrain', 'streets'].map(s => (
                <button
                  key={s}
                  onClick={() => setMapStyle(s)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    textTransform: 'capitalize',
                    borderRadius: '4px',
                    border: 'none',
                    background: mapStyle === s ? '#334155' : 'transparent',
                    color: mapStyle === s ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: mapStyle === s ? 700 : 500,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: '1px', height: '22px', background: '#334155' }}></div>

          <div style={{
            fontSize: '0.78rem',
            color: '#34d399',
            background: 'rgba(52, 211, 153, 0.12)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            padding: '5px 12px',
            borderRadius: '6px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
            {nearbyWells.length} Offset Wells in {radiusKm}km
          </div>
        </div>
      </div>

      {/* Inset Framed Map Section (Reduced Size, No Overlap) */}
      <div style={{ 
        flex: 1, 
        padding: '16px 24px 20px', 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '650px',
        position: 'relative',
        zIndex: 1,
        isolation: 'isolate'
      }}>
        <div style={{ 
          flex: 1, 
          width: '100%', 
          height: '100%', 
          minHeight: '650px',
          borderRadius: '12px', 
          overflow: 'hidden', 
          border: '1px solid var(--color-border)', 
          position: 'relative',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)'
        }}>

          {loadingAll ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingState message="Loading well GPS data & map tiles..." />
            </div>
          ) : activeWell && !isNaN(Number(activeWell.latitude)) && !isNaN(Number(activeWell.longitude)) ? (
            <MapContainer 
              center={[Number(activeWell.latitude), Number(activeWell.longitude)]} 
              zoom={11} 
              style={{ height: '100%', width: '100%', zIndex: 1 }} 
              zoomControl={false}
            >
              <TileLayer 
                key={mapStyle}
                url={tiles[mapStyle]} 
                attribution="&copy; Esri & OpenStreetMap contributors" 
                maxZoom={19}
              />
              {mapStyle === 'dark' && (
                <TileLayer
                  key="dark-labels"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                  attribution="&copy; Esri"
                  maxZoom={19}
                />
              )}
              <MapBoundsHandler activeWell={activeWell} radiusKm={radiusKm} />

              {/* Active Well Marker */}
              <Marker
                position={[Number(activeWell.latitude), Number(activeWell.longitude)]}
                icon={createWellIcon(true, false)}
              >
                <Popup>
                  <div style={{ fontWeight: 600 }}>{activeWell.well_name} (Active)</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>Depth: {activeWell.current_depth || activeWell.depth || 2860} m</div>
                </Popup>
              </Marker>

              {/* Radius Circle */}
              <Circle
                center={[Number(activeWell.latitude), Number(activeWell.longitude)]}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#38bdf8', fillColor: '#38bdf8',
                  fillOpacity: 0.05, weight: 1, dashArray: '5 5'
                }}
              />

              {/* Nearby Wells */}
              {!loadingNearby && nearbyWells
                .filter(well => well.latitude != null && well.longitude != null && !isNaN(Number(well.latitude)) && !isNaN(Number(well.longitude)))
                .map(well => (
                  <Marker
                    key={well.id}
                    position={[Number(well.latitude), Number(well.longitude)]}
                    icon={createWellIcon(false, true)}
                    eventHandlers={{ click: () => handleNearbyClick(well) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'var(--font-sans)', minWidth: '160px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{well.well_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                          Distance: <strong>{typeof well.distance_km === 'number' ? `${well.distance_km.toFixed(1)} km` : '---'}</strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                          Match: <strong style={{color: well.formation_match ? '#34d399' : '#f87171'}}>{well.formation_match ? 'YES' : 'NO'}</strong>
                        </div>
                        <button
                          style={{
                            marginTop: '8px', padding: '4px 10px', background: 'rgba(255,255,255,0.1)',
                            color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
                            fontSize: '0.75rem', fontWeight: 600, width: '100%'
                          }}
                          onClick={() => handleNearbyClick(well)}
                        >
                          Analyze Intelligence
                        </button>
                      </div>
                    </Popup>
                  </Marker>
              ))}

            </MapContainer>
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <ErrorState message="Could not locate valid coordinates for the selected well." />
            </div>
          )}
        </div>
      </div>

      {/* Side Intelligence Panel (fixed right drawer, map stays in place) */}
      <Drawer
        open={showIntelligencePanel && !!selectedNearbyWell}
        onClose={() => setShowIntelligencePanel(false)}
        title="Offset Well Intelligence"
        footer={selectedNearbyWell && (
          <>
            <button
              type="button"
              onClick={() => navigate(`/wells/${selectedNearbyWell.id}`)}
              style={{ flex: 1, backgroundColor: '#C45C26', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '10px 16px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
            >
              View Well Details
            </button>
            <button
              type="button"
              onClick={() => navigate(`/compare?wells=${activeWellId},${selectedNearbyWell.id}`)}
              style={{ flex: 1, backgroundColor: 'transparent', color: '#1A1410', border: '1px solid #D1C7B8', borderRadius: '6px', padding: '10px 16px', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}
            >
              Compare
            </button>
          </>
        )}
      >
        {selectedNearbyWell && (() => {
          const card = { backgroundColor: '#F7F3EC', border: '1px solid #E8DCC8', borderRadius: '8px' };
          const label = { fontSize: '12px', color: '#6B5E50', fontWeight: 500 };
          const sectionHead = { margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600, color: '#1A1410', opacity: 1, display: 'flex', alignItems: 'center', gap: '8px' };
          const section = { padding: '16px 0', borderBottom: '1px solid #EDE4D3' };
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ paddingBottom: '16px', borderBottom: '1px solid #EDE4D3' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1A1410' }}>{selectedNearbyWell.well_name}</h2>
                <div style={{ color: '#6B5E50', fontSize: '13px', marginTop: '4px' }}>
                  {selectedNearbyWell.field || 'Assam Basin'} • {selectedNearbyWell.status || 'Active'}
                </div>
              </div>

              <div style={{ ...section, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ ...card, padding: '12px' }}>
                  <div style={label}>Distance</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#1A1410' }}>
                    {typeof selectedNearbyWell.distance_km === 'number' ? `${selectedNearbyWell.distance_km.toFixed(2)} km` : '---'}
                  </div>
                </div>
                <div style={{ ...card, padding: '12px' }}>
                  <div style={label}>Similarity Score</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#047857' }}>
                    {Math.round((selectedNearbyWell.similarity_score || 0.85) * 100)}%
                  </div>
                </div>
              </div>

              <div style={section}>
                <h4 style={sectionHead}>
                  <Layers size={16} style={{ color: '#C45C26' }} /> Geological Correlation
                </h4>
                <div style={{ ...card, overflow: 'hidden' }}>
                  <div style={{ padding: '12px', borderBottom: '1px solid #E8DCC8', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6B5E50', fontSize: '14px' }}>Formation Match</span>
                    <span style={{ color: selectedNearbyWell.formation_match ? '#047857' : '#B91C1C', fontWeight: 600, fontSize: '14px' }}>
                      {selectedNearbyWell.formation_match ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <div style={{ padding: '12px', borderBottom: selectedNearbyWell.matching_formations?.length > 0 ? '1px solid #E8DCC8' : 'none', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6B5E50', fontSize: '14px' }}>Depth Overlap</span>
                    <span style={{ color: '#1A1410', fontSize: '14px', fontWeight: 500 }}>
                      {selectedNearbyWell.depth_overlap_range ? `${selectedNearbyWell.depth_overlap_range} m` : (selectedNearbyWell.depth_overlap ? 'YES' : 'NO')}
                    </span>
                  </div>
                  {selectedNearbyWell.matching_formations?.length > 0 && (
                    <div style={{ padding: '12px' }}>
                      <span style={{ color: '#6B5E50', fontSize: '14px', display: 'block', marginBottom: '8px' }}>Shared Formations:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {selectedNearbyWell.matching_formations.map((f, i) => (
                          <span key={i} style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: 500 }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ ...section, borderBottom: 'none' }}>
                <h4 style={sectionHead}>
                  <Activity size={16} style={{ color: '#B45309' }} /> Historical Context
                </h4>
                <div style={{ ...card, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 600, color: '#B45309' }}>
                      {selectedNearbyWell.historical_events_count ?? 2}
                    </div>
                    <div style={label}>Events Recorded</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/analytics?well=${selectedNearbyWell.id}`)}
                    style={{ background: 'transparent', border: '1px solid #D1C7B8', borderRadius: '6px', padding: '6px 12px', color: '#1A1410', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                  >
                    View Events
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Drawer>

    </motion.div>
  );
}
