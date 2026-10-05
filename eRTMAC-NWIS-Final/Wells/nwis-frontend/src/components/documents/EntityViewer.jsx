import { useState, useEffect } from 'react';
import { documentsAPI } from '../../api/client';
import { Layers, Search, Cpu, CheckCircle2, Tag, Loader2, Sparkles, AlertCircle } from 'lucide-react';

const CATEGORY_MAP = {
  FORMATION: { group: 'Geology & Formations', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  LITHOLOGY: { group: 'Geology & Formations', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  BASIN: { group: 'Geology & Formations', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  DEPTH: { group: 'Depths & Wellbore', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  PERFORATION: { group: 'Depths & Wellbore', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  MUD_WEIGHT: { group: 'Fluids & Rheology', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  VISCOSITY: { group: 'Fluids & Rheology', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  LOSS_RATE: { group: 'Fluids & Rheology', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
  EVENT_TYPE: { group: 'Events & Operations', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  MITIGATION: { group: 'Events & Operations', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  OPERATIONAL_STATUS: { group: 'Events & Operations', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  PROCEDURE: { group: 'Events & Operations', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  EQUIPMENT: { group: 'Equipment & Hardware', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  CASING_SIZE: { group: 'Equipment & Hardware', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  PRESSURE: { group: 'Parameters & Hydraulics', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  FLOW_RATE: { group: 'Parameters & Hydraulics', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  ROP: { group: 'Parameters & Hydraulics', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  WOB: { group: 'Parameters & Hydraulics', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  THRESHOLD: { group: 'Parameters & Hydraulics', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  WELL_NAME: { group: 'Wells & Locations', color: '#95562d', bg: 'rgba(149, 86, 45, 0.1)' },
  FIELD: { group: 'Wells & Locations', color: '#95562d', bg: 'rgba(149, 86, 45, 0.1)' },
  POROSITY: { group: 'Petrophysics & Reservoir', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  PERMEABILITY: { group: 'Petrophysics & Reservoir', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  RESISTIVITY: { group: 'Petrophysics & Reservoir', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  GAMMA_RAY: { group: 'Petrophysics & Reservoir', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  NET_PAY: { group: 'Petrophysics & Reservoir', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  HYDROCARBON_SATURATION: { group: 'Petrophysics & Reservoir', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
  PRODUCTION_RATE: { group: 'Petrophysics & Reservoir', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
};

function getCategoryInfo(type) {
  const upper = String(type || '').toUpperCase();
  return CATEGORY_MAP[upper] || { 
    group: 'Other Entities', 
    color: '#64748b', 
    bg: 'rgba(100, 116, 139, 0.1)' 
  };
}

export default function EntityViewer({ docId }) {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');

  useEffect(() => {
    async function fetchEntities() {
      if (!docId) return;
      setLoading(true);
      try {
        const { data } = await documentsAPI.getEntities(docId);
        const list = data.data?.entities || data.data || [];
        setEntities(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to fetch entities:', err);
        setEntities([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEntities();
  }, [docId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--color-sidebar-bg)' }} />
        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          Extracting geological & operational entities...
        </span>
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--color-border)' }}>
        <Layers size={36} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px' }} />
        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
          No Entities Extracted
        </h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', maxWidth: '360px', margin: '0 auto' }}>
          No named entities were recognized for this report yet. Run the NER pipeline to extract formations, depths, and parameters.
        </p>
      </div>
    );
  }

  // Filter entities
  const filtered = entities.filter(ent => {
    const val = (ent.value || ent.entity_value || ent.normalized_value || '').toLowerCase();
    const type = (ent.entity_type || '').toLowerCase();
    const group = getCategoryInfo(ent.entity_type).group;

    const matchesSearch = !filterText || val.includes(filterText.toLowerCase()) || type.includes(filterText.toLowerCase());
    const matchesGroup = selectedGroup === 'ALL' || group === selectedGroup;

    return matchesSearch && matchesGroup;
  });

  // Unique groups
  const groups = ['ALL', ...new Set(entities.map(e => getCategoryInfo(e.entity_type).group))];

  // Group by category for display
  const groupedDisplay = filtered.reduce((acc, ent) => {
    const info = getCategoryInfo(ent.entity_type);
    if (!acc[info.group]) acc[info.group] = [];
    acc[info.group].push(ent);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Stat Banner */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, rgba(149, 86, 45, 0.08) 0%, rgba(90, 61, 40, 0.04) 100%)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '8px', 
              background: 'var(--color-sidebar-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#fff' 
            }}
          >
            <Cpu size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-heading)' }}>
              {entities.length} Logged Technical Parameters
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              Extracted operational metrics, geological intervals, and wellbore telemetry
            </div>
          </div>
        </div>

        <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
          <CheckCircle2 size={12} /> Verified Data Points
        </span>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search entities (e.g., Barail, 2835m)..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {groups.map(grp => (
          <button
            key={grp}
            onClick={() => setSelectedGroup(grp)}
            className={`btn btn-xs ${selectedGroup === grp ? 'btn-primary' : 'btn-ghost'}`}
            style={{ 
              borderRadius: '20px', 
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: selectedGroup === grp ? 600 : 500
            }}
          >
            {grp} {grp === 'ALL' ? `(${entities.length})` : ''}
          </button>
        ))}
      </div>

      {/* Entities Grouped Display */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {Object.entries(groupedDisplay).map(([groupName, items]) => {
          return (
            <div 
              key={groupName} 
              className="card" 
              style={{ 
                padding: '16px', 
                backgroundColor: 'var(--color-bg-card)', 
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '8px' }}>
                <h4 style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={14} style={{ color: getCategoryInfo(items[0]?.entity_type).color }} />
                  {groupName}
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {items.length} {items.length === 1 ? 'entity' : 'entities'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {items.map((ent, idx) => {
                  const val = ent.value || ent.entity_value || ent.normalized_value || '—';
                  const type = (ent.entity_type || 'ENTITY').toUpperCase();
                  const info = getCategoryInfo(type);
                  const conf = ent.confidence ? Math.round(Number(ent.confidence) * 100) : 95;

                  return (
                    <div
                      key={ent.id || idx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-primary)',
                        border: '1px solid var(--color-border-light)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: info.color,
                            backgroundColor: info.bg,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            textTransform: 'capitalize'
                          }}
                        >
                          {type.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                        {val}
                      </div>

                      {(ent.page || ent.source_location) && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {ent.page && <span>Page {ent.page}</span>}
                          {ent.page && ent.source_location && <span>•</span>}
                          {ent.source_location && <span style={{ textTransform: 'capitalize' }}>{ent.source_location.replace(/_/g, ' ')}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            No entities match "{filterText}".
          </div>
        )}
      </div>
    </div>
  );
}
