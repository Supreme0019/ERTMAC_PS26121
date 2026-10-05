// =============================================================================
// NWIS Frontend — Well Create / Edit Form
// =============================================================================

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, X, Loader2, MapPin, Drill, Calendar, Layers } from 'lucide-react';
import { wellsAPI } from '../api/client';

// ── Shared Field Definitions ─────────────────────────────────────────────────
const FIELDS = [
  { id: 'well_name', label: 'Well Identifier (API No.)', type: 'text', required: true, placeholder: 'e.g. NWIS-LKW-2026-01', colSpan: 2 },
  { id: 'field', label: 'Field / Petroleum Block', type: 'text', required: true, placeholder: 'e.g. Lakwa-Lakhmani PML' },
  { id: 'status', label: 'Operational Status', type: 'select', required: true, options: [
    'drilling', 'completed', 'suspended', 'abandoned', 'planned', 'producing'
  ]},
  { id: 'latitude', label: 'Surface Latitude (°N)', type: 'number', step: '0.0001', placeholder: '26.7800' },
  { id: 'longitude', label: 'Surface Longitude (°E)', type: 'number', step: '0.0001', placeholder: '94.2100' },
  { id: 'current_depth', label: 'Current / Last Reported Depth (m)', type: 'number', step: '1', placeholder: '3200' },
  { id: 'total_depth', label: 'Planned Total Depth (m)', type: 'number', step: '1', placeholder: '3500' },
  { id: 'spud_date', label: 'Spud Date', type: 'date' },
  { id: 'completion_date', label: 'Completion Date', type: 'date' },
  { id: 'operator', label: 'Operator', type: 'text', placeholder: 'e.g. Oil India Limited' },
  { id: 'rig_name', label: 'Drilling Rig / Unit', type: 'text', placeholder: 'e.g. OIL Rig #7' },
  { id: 'well_type', label: 'Well Classification', type: 'select', options: [
    'development', 'exploratory', 'appraisal', 'injection', 're-entry'
  ]},
];

const EMPTY_FORM = Object.fromEntries(FIELDS.map(f => [f.id, '']));

// ── WellForm (shared create/edit logic) ─────────────────────────────────────
function WellForm({ mode }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = mode === 'edit';

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isEdit && id) {
      wellsAPI.getById(id)
        .then(({ data }) => {
          const well = data?.data?.well || data?.data || {};
          const filled = {};
          FIELDS.forEach(f => {
            filled[f.id] = well[f.id] ?? '';
            // format dates for <input type="date">
            if (f.type === 'date' && filled[f.id]) {
              filled[f.id] = new Date(filled[f.id]).toISOString().slice(0, 10);
            }
          });
          setForm(filled);
        })
        .catch(err => setError(err.response?.data?.error?.message || 'Failed to load well data.'))
        .finally(() => setLoading(false));
    }
  }, [isEdit, id]);

  const handleChange = (fieldId, value) => {
    setForm(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      // Cast numeric fields
      ['latitude', 'longitude', 'current_depth', 'total_depth'].forEach(k => {
        if (payload[k] !== '') payload[k] = parseFloat(payload[k]);
      });
      // Remove empty strings
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });

      if (isEdit) {
        await wellsAPI.update(id, payload);
      } else {
        await wellsAPI.create(payload);
      }
      navigate('/wells');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Save failed. Check required fields.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', color: 'var(--color-text-secondary)' }}>
        <Loader2 size={28} className="spin" /> Loading well data...
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: '860px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 className="page-title">
            {isEdit ? `Edit Well — ${form.well_name || id}` : 'Register New Well'}
          </h1>
          <p className="page-subtitle">
            {isEdit
              ? 'Update well record, coordinates, depth, and classification.'
              : 'Add a new well to the NWIS asset register. Fields marked * are required.'}
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ backgroundColor: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.3)', borderRadius: '6px', padding: '10px 16px', marginBottom: '16px', fontSize: '0.85rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <X size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {FIELDS.map(field => (
              <div
                key={field.id}
                className="form-group-custom"
                style={{ gridColumn: field.colSpan === 2 ? 'span 2' : undefined }}
              >
                <label htmlFor={field.id}>
                  {field.label}{field.required ? ' *' : ''}
                </label>

                {field.type === 'select' ? (
                  <select
                    id={field.id}
                    className="input"
                    value={form[field.id]}
                    onChange={e => handleChange(field.id, e.target.value)}
                    required={field.required}
                    style={{ fontSize: '0.85rem' }}
                  >
                    <option value="">— Select —</option>
                    {field.options.map(opt => (
                      <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.id}
                    type={field.type}
                    step={field.step}
                    className="input"
                    value={form[field.id]}
                    onChange={e => handleChange(field.id, e.target.value)}
                    placeholder={field.placeholder || ''}
                    required={field.required}
                    style={{ fontSize: '0.85rem', fontFamily: ['latitude', 'longitude', 'current_depth', 'total_depth'].includes(field.id) ? 'var(--font-mono)' : undefined }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/wells')}>
            <X size={15} /> Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : isEdit ? 'Update Well' : 'Create Well'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

export function WellCreatePage() {
  return <WellForm mode="create" />;
}

export function WellEditPage() {
  return <WellForm mode="edit" />;
}
