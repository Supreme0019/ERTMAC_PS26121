// =============================================================================
// NWIS Frontend — Wells List Page
// =============================================================================
// Full CRUD: list, search/filter, add (modal), edit (modal), delete (confirm).
// All operations wire directly to wellsAPI (POST /wells, PATCH /wells/:id,
// DELETE /wells/:id) and respect backend Zod schema field names.
// =============================================================================

import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Search, ChevronRight,
  ArrowUpDown, RefreshCw, Edit2, Trash2, X, Save, Loader
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { wellsAPI } from '../api/client';
import { formatDepth } from '../utils/formatters';
import './Wells.css';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { class: 'badge-success', label: 'Active' },
  drilling:  { class: 'badge-success', label: 'Drilling' },
  completed: { class: 'badge-neutral', label: 'Completed' },
  suspended: { class: 'badge-warning', label: 'Suspended' },
  abandoned: { class: 'badge-danger',  label: 'Abandoned' },
  planned:   { class: 'badge-info',    label: 'Planned' },
};

// Roles that may create / edit wells (must match backend RBAC)
const CAN_EDIT_ROLES = ['DRILLING_ENGINEER', 'SUPERVISOR', 'DATA_ADMIN', 'SYSTEM_ADMIN'];
// Only SYSTEM_ADMIN may delete wells
const CAN_DELETE_ROLES = ['SYSTEM_ADMIN'];

// Empty form matching createWellSchema required fields
const EMPTY_FORM = {
  well_name:     '',
  field:         '',
  status:        'planned',
  well_type:     'development',
  latitude:      '',
  longitude:     '',
  total_depth:   '',
  spud_date:     '',
  current_depth: '',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function WellsPage() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  // List state
  const [wells,        setWells]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy,       setSortBy]       = useState('name');

  // Modal state
  const [modal,        setModal]        = useState(null); // null | 'add' | 'edit'
  const [editingWell,  setEditingWell]  = useState(null);
  const [formData,     setFormData]     = useState(EMPTY_FORM);
  const [formLoading,  setFormLoading]  = useState(false);
  const [formError,    setFormError]    = useState('');

  // Delete confirmation state
  const [deletingWell, setDeletingWell] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Derived permissions
  const canEdit   = user && CAN_EDIT_ROLES.includes(user.role);
  const canDelete = user && CAN_DELETE_ROLES.includes(user.role);

  useEffect(() => { fetchWells(); }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────

  async function fetchWells() {
    setLoading(true);
    try {
      const { data } = await wellsAPI.getAll({ limit: 100 });
      setWells(data.data?.wells || data.wells || []);
    } catch {
      setWells([]);
    } finally {
      setLoading(false);
    }
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setFormData(EMPTY_FORM);
    setEditingWell(null);
    setFormError('');
    setModal('add');
  }

  function openEdit(well, e) {
    e.stopPropagation();
    setFormData({
      well_name:     well.well_name || '',
      field:         well.field || '',
      status:        well.status || 'planned',
      well_type:     well.well_type || 'development',
      latitude:      well.latitude  != null ? String(well.latitude)  : '',
      longitude:     well.longitude != null ? String(well.longitude) : '',
      total_depth:   well.total_depth   != null ? String(well.total_depth)   : '',
      spud_date:     well.spud_date ? well.spud_date.split('T')[0] : '',
      current_depth: well.current_depth != null ? String(well.current_depth) : '',
    });
    setEditingWell(well);
    setFormError('');
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setFormError('');
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  async function handleFormSubmit(e) {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    // Build payload — coerce numeric fields, skip empty strings
    const payload = {
      well_name: formData.well_name.trim(),
      field:     formData.field.trim() || undefined,
      status:    formData.status,
      latitude:  parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
    };
    if (formData.total_depth)   payload.total_depth   = parseFloat(formData.total_depth);
    if (formData.current_depth) payload.current_depth = parseFloat(formData.current_depth);
    if (formData.spud_date)     payload.spud_date     = new Date(formData.spud_date).toISOString();

    // Basic client-side guard before hitting backend
    if (!payload.well_name) { setFormError('Well name is required.'); setFormLoading(false); return; }
    if (isNaN(payload.latitude) || isNaN(payload.longitude)) {
      setFormError('Valid latitude and longitude are required.');
      setFormLoading(false);
      return;
    }

    try {
      if (modal === 'add') {
        await wellsAPI.create(payload);
      } else {
        await wellsAPI.update(editingWell.id, payload);
      }
      closeModal();
      fetchWells();
    } catch (err) {
      const msg = err.response?.data?.message
        || err.response?.data?.errors?.[0]?.message
        || 'Operation failed. Please try again.';
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  }

  function promptDelete(well, e) {
    e.stopPropagation();
    setDeletingWell(well);
  }

  async function confirmDelete() {
    if (!deletingWell) return;
    setDeleteLoading(true);
    try {
      await wellsAPI.delete(deletingWell.id);
      setDeletingWell(null);
      fetchWells();
    } catch (err) {
      alert('Failed to delete well: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Filtering / sorting ────────────────────────────────────────────────────

  const filteredWells = wells
    .filter(w => {
      const q = searchTerm.toLowerCase();
      const matchSearch = !q ||
        (w.well_name || '').toLowerCase().includes(q) ||
        (w.field     || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || w.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name')  return (a.well_name || '').localeCompare(b.well_name || '');
      if (sortBy === 'depth') {
        const da = parseFloat(a.current_depth || a.total_depth) || 0;
        const db = parseFloat(b.current_depth || b.total_depth) || 0;
        return db - da;
      }
      if (sortBy === 'date')  return new Date(b.spud_date || 0) - new Date(a.spud_date || 0);
      return 0;
    });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Well <span className="text-gradient">Registry</span></h1>
            <p className="page-subtitle">{filteredWells.length} wells across Oil India fields</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchWells} id="btn-refresh-wells">
              <RefreshCw size={14} /> Refresh
            </button>
            {canEdit && (
              <button className="btn btn-primary btn-sm" onClick={openAdd} id="btn-add-well">
                <Plus size={14} /> Add Well
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="wells-filters">
          <div className="wells-search">
            <Search size={16} className="wells-search-icon" />
            <input
              type="text"
              className="input"
              placeholder="Search by well name or field..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              id="wells-search"
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <select
            className="input select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            id="wells-status-filter"
            style={{ width: '160px' }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="drilling">Drilling</option>
            <option value="completed">Completed</option>
            <option value="suspended">Suspended</option>
            <option value="abandoned">Abandoned</option>
            <option value="planned">Planned</option>
          </select>
          <select
            className="input select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            id="wells-sort"
            style={{ width: '150px' }}
          >
            <option value="name">Sort by Name</option>
            <option value="depth">Sort by Depth</option>
            <option value="date">Sort by Date</option>
          </select>
        </div>

        {/* Wells Grid */}
        {loading ? (
          <div className="spinner-overlay"><div className="spinner" /></div>
        ) : filteredWells.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MapPin size={28} /></div>
            <h3 className="empty-state-title">No wells found</h3>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="wells-grid">
            {filteredWells.map((well, i) => {
              const isActive     = well.status === 'active' || well.status === 'drilling';
              const curDepth     = parseFloat(well.current_depth) || 0;
              const totDepth     = parseFloat(well.total_depth)   || curDepth;
              const progressPct  = totDepth > 0 ? Math.min(100, Math.round((curDepth / totDepth) * 100)) : 100;
              const formationName = well.current_formation_name || well.current_formation || 'Barail Group';

              return (
                <motion.div
                  key={well.id}
                  className="well-card card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  onClick={() => navigate(`/wells/${well.id}`)}
                  id={`well-card-${well.id}`}
                >
                  <div className="well-card-top">
                    <div className="well-card-name">
                      <MapPin size={15} className="well-card-pin" />
                      <span>{well.well_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className={`badge ${STATUS_CONFIG[well.status]?.class || 'badge-neutral'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />}
                        {STATUS_CONFIG[well.status]?.label || well.status}
                      </span>
                      {/* Edit / Delete action buttons — only shown to authorised roles */}
                      {canEdit && (
                        <button
                          className="well-card-action"
                          title="Edit well"
                          id={`btn-edit-well-${well.id}`}
                          onClick={e => openEdit(well, e)}
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="well-card-action well-card-action-danger"
                          title="Delete well"
                          id={`btn-delete-well-${well.id}`}
                          onClick={e => promptDelete(well, e)}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="well-card-details">
                    <div className="well-card-detail">
                      <span className="well-card-detail-label">Field</span>
                      <span className="well-card-detail-value" title={well.field || '—'}>
                        {well.field || '—'}
                      </span>
                    </div>
                    <div className="well-card-detail">
                      <span className="well-card-detail-label">{isActive ? 'Current Depth' : 'Total Depth'}</span>
                      <span className="well-card-detail-value" style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatDepth(curDepth || totDepth)}
                      </span>
                    </div>
                    <div className="well-card-detail">
                      <span className="well-card-detail-label">Formation</span>
                      <span className="well-card-detail-value" title={formationName} style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formationName}
                      </span>
                    </div>
                    <div className="well-card-detail">
                      <span className="well-card-detail-label">{isActive ? 'Drilling Progress' : 'Status'}</span>
                      {isActive ? (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.84rem', fontFamily: 'var(--font-mono)' }}>
                              {progressPct}%
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {curDepth.toLocaleString()}m / {totDepth.toLocaleString()}m
                            </span>
                          </div>
                          <div className="well-card-progress-bar">
                            <div className="well-card-progress-fill" style={{ width: `${progressPct}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span
                          className="well-card-detail-value"
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontWeight: 500,
                            fontSize: '0.85rem',
                          }}
                        >
                          {well.status === 'completed' ? 'Drilled & Logged' : (well.status === 'suspended' ? 'Capped / Standby' : (well.status || 'Standard'))}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="well-card-footer">
                    <span className="well-card-spud">
                      {well.spud_date
                        ? `Spud: ${new Date(well.spud_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'Basin Record'}
                    </span>
                    <span className="well-card-link">
                      View Details <ChevronRight size={14} className="well-card-arrow" />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{ opacity: 0, scale: 0.95, y: 16  }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">
                  {modal === 'add' ? 'Register New Well' : `Edit — ${editingWell?.well_name}`}
                </h2>
                <button className="modal-close" onClick={closeModal} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="modal-body" noValidate>
                {/* Row 1: Well Name + Field */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="wf-well-name">
                      Well Name <span className="form-required">*</span>
                    </label>
                    <input
                      id="wf-well-name"
                      name="well_name"
                      className="input"
                      placeholder="e.g. LKW-A-201"
                      value={formData.well_name}
                      onChange={handleFormChange}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="wf-field">Field</label>
                    <input
                      id="wf-field"
                      name="field"
                      className="input"
                      placeholder="e.g. Lakwa"
                      value={formData.field}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                {/* Row 2: Status + Well Type */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="wf-status">Status</label>
                    <select id="wf-status" name="status" className="input select" value={formData.status} onChange={handleFormChange}>
                      <option value="planned">Planned</option>
                      <option value="active">Active</option>
                      <option value="drilling">Drilling</option>
                      <option value="completed">Completed</option>
                      <option value="suspended">Suspended</option>
                      <option value="abandoned">Abandoned</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="wf-type">Well Type</label>
                    <select id="wf-type" name="well_type" className="input select" value={formData.well_type} onChange={handleFormChange}>
                      <option value="development">Development</option>
                      <option value="exploration">Exploration</option>
                      <option value="appraisal">Appraisal</option>
                      <option value="injection">Injection</option>
                      <option value="observation">Observation</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Latitude + Longitude */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="wf-lat">
                      Latitude (°N) <span className="form-required">*</span>
                    </label>
                    <input
                      id="wf-lat"
                      name="latitude"
                      type="number"
                      step="0.000001"
                      min="-90" max="90"
                      className="input"
                      placeholder="e.g. 26.9831"
                      value={formData.latitude}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="wf-lon">
                      Longitude (°E) <span className="form-required">*</span>
                    </label>
                    <input
                      id="wf-lon"
                      name="longitude"
                      type="number"
                      step="0.000001"
                      min="-180" max="180"
                      className="input"
                      placeholder="e.g. 94.9285"
                      value={formData.longitude}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                </div>

                {/* Row 4: Total Depth + Spud Date */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="wf-total-depth">Total Depth (m)</label>
                    <input
                      id="wf-total-depth"
                      name="total_depth"
                      type="number"
                      step="1"
                      min="0"
                      className="input"
                      placeholder="e.g. 3200"
                      value={formData.total_depth}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="wf-spud">Spud Date</label>
                    <input
                      id="wf-spud"
                      name="spud_date"
                      type="date"
                      className="input"
                      value={formData.spud_date}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                {/* Row 5: Current Depth (edit only — would be confusing on add) */}
                {modal === 'edit' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="wf-current-depth">Current Depth (m)</label>
                      <input
                        id="wf-current-depth"
                        name="current_depth"
                        type="number"
                        step="1"
                        min="0"
                        className="input"
                        placeholder="e.g. 2700"
                        value={formData.current_depth}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-group" /> {/* spacer */}
                  </div>
                )}

                {/* Error banner */}
                {formError && (
                  <div className="form-error-banner" role="alert">
                    {formError}
                  </div>
                )}

                {/* Actions */}
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={formLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={formLoading} id="btn-modal-submit">
                    {formLoading
                      ? <><Loader size={14} className="spin" /> Saving…</>
                      : <><Save size={14} /> {modal === 'add' ? 'Register Well' : 'Save Changes'}</>
                    }
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {deletingWell && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deleteLoading && setDeletingWell(null)}
          >
            <motion.div
              className="modal modal-sm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title" style={{ color: 'var(--color-danger)' }}>
                  Delete Well
                </h2>
                <button className="modal-close" onClick={() => setDeletingWell(null)} disabled={deleteLoading}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  You are about to permanently delete:
                </p>
                <p style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-heading)', fontSize: '1rem', marginBottom: '16px' }}>
                  {deletingWell.well_name}
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  This will remove all associated trajectory, formation, parameter, and event data.
                  <strong style={{ color: 'var(--color-danger)' }}> This action cannot be undone.</strong>
                </p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeletingWell(null)} disabled={deleteLoading}>
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={confirmDelete}
                  disabled={deleteLoading}
                  id="btn-confirm-delete"
                >
                  {deleteLoading ? <><Loader size={14} className="spin" /> Deleting…</> : <><Trash2 size={14} /> Delete Well</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
