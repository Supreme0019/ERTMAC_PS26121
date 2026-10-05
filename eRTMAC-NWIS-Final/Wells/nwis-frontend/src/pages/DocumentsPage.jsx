import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Upload, Search, Eye, RefreshCw, Clock, 
  CheckCircle, AlertCircle, AlertTriangle, Loader2, Database, Layers, 
  Sparkles, Filter, ChevronRight, HardDrive 
} from 'lucide-react';
import { documentsAPI } from '../api/client';
import DocumentDrawer from '../components/documents/DocumentDrawer';
import './DocumentsPage.css';


const FILTER_CATEGORIES = [
  { id: 'all', label: 'All Documents' },
  { id: 'daily_report', label: 'Daily Reports' },
  { id: 'mud_log', label: 'Mud Logs' },
  { id: 'completion_report', label: 'Completion' },
  { id: 'incident_report', label: 'Incidents' },
  { id: 'geological_survey', label: 'Geological' },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const { data } = await documentsAPI.getAll({ limit: 50 });
      const docs = data.data?.documents || data.data || [];
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (error) {
      console.error("Failed to fetch documents", error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('document_type', 'daily_report');
      await documentsAPI.upload(formData);
      fetchDocuments();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  const getStatusBadge = (doc) => {
    const status = (doc.processing_status || doc.ocr_status || doc.status || 'completed').toLowerCase();
    switch (status) {
      case 'completed':
      case 'processed':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={13} /> Verified
          </span>
        );
      case 'processing':
        return (
          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Loader2 size={13} className="spin" /> Reviewing
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={13} /> Check Required
          </span>
        );
      case 'needs_review':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={13} /> Needs Review
          </span>
        );
      case 'degraded':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={13} /> OCR Degraded
          </span>
        );
      default:
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={13} /> Queued
          </span>
        );
    }
  };

  const filtered = documents.filter(doc => {
    const filename = (doc.original_filename || doc.original_name || '').toLowerCase();
    const type = (doc.document_type || '').toLowerCase();
    const well = (doc.well_name || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = !searchTerm || filename.includes(search) || type.includes(search) || well.includes(search);
    const matchesCategory = categoryFilter === 'all' || type === categoryFilter || (categoryFilter === 'geological' && (type.includes('geo') || type.includes('formation')));

    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="documents-page-container">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text-heading)' }}>
            Well Records & Document Archive
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Official drilling logs, mud reports, completion files, and offset well records for Assam-Arakan Basin assets.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchDocuments} title="Refresh documents">
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Document'}
            <input type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} style={{ display: 'none' }} id="doc-upload" />
          </label>
        </div>
      </div>

      {/* Operational Summary Strip */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '14px', 
          marginBottom: 'var(--space-lg)' 
        }}
      >
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(149, 86, 45, 0.1)', color: 'var(--color-sidebar-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-heading)' }}>
              {documents.length} Reports
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              Archived Field Documents
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(52, 211, 153, 0.1)', color: 'var(--color-accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HardDrive size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-heading)' }}>
              Lakwa & Digboi
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              Operational Fields Covered
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Database size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-heading)' }}>
              Searchable Logs
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              Formations, ROP & Mud Telemetry
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-heading)' }}>
              DGH Standard
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              Verified Reporting Formats
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '12px', 
          marginBottom: 'var(--space-md)' 
        }}
      >
        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTER_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`btn btn-xs ${categoryFilter === cat.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                borderRadius: '20px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: categoryFilter === cat.id ? 600 : 500
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '280px' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search report, well, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 34, fontSize: '0.85rem' }}
            id="doc-search"
          />
        </div>
      </div>

      {/* Documents Data Table */}
      {loading ? (
        <div className="card" style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Loader2 size={36} className="spin" style={{ color: 'var(--color-sidebar-bg)' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Loading Oil India documents...</span>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <FileText size={40} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px' }} />
              <h3 className="empty-state-title" style={{ fontSize: '1.1rem', fontWeight: 600 }}>No documents found</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Try adjusting your search criteria or filter categories.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Document Title</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Category</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Well</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Date Logged</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc, i) => {
                    const isSelected = selectedDocId === doc.id;
                    const filename = doc.original_filename || doc.original_name || 'OIL Document';
                    const docType = doc.document_type?.replace(/_/g, ' ') || 'Report';
                    const wellName = doc.well_name || 'OIL Field Well';
                    const formattedDate = doc.document_date || doc.created_at
                      ? new Date(doc.document_date || doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—';

                    return (
                      <motion.tr
                        key={doc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(149, 86, 45, 0.08)' : 'transparent',
                          borderBottom: '1px solid var(--color-border-light)',
                          transition: 'background-color 0.15s ease'
                        }}
                        onClick={() => setSelectedDocId(doc.id)}
                        className="hover-row"
                      >
                        {/* Document Name */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div 
                              style={{ 
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '6px', 
                                backgroundColor: isSelected ? 'var(--color-sidebar-bg)' : 'rgba(149, 86, 45, 0.1)', 
                                color: isSelected ? '#fff' : 'var(--color-sidebar-bg)', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <FileText size={16} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--color-text-primary)' }}>
                                {filename}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                PDF Record • Verified Archive
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td style={{ padding: '14px 16px' }}>
                          <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: '0.78rem' }}>
                            {docType}
                          </span>
                        </td>

                        {/* Well */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.82rem', color: 'var(--color-sidebar-bg)' }}>
                            {wellName}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          {getStatusBadge(doc)}
                        </td>

                        {/* Date */}
                        <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                          {formattedDate}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocId(doc.id);
                            }}
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              backgroundColor: isSelected ? 'var(--color-sidebar-bg)' : undefined,
                              color: isSelected ? '#fff' : undefined,
                              borderColor: isSelected ? 'var(--color-sidebar-bg)' : undefined
                            }}
                          >
                            <Eye size={13} /> View Record
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Interactive 3-Way Document Inspection Drawer */}
      <AnimatePresence>
        {selectedDocId && (
          <DocumentDrawer 
            docId={selectedDocId} 
            onClose={() => setSelectedDocId(null)} 
            onReprocess={fetchDocuments}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
