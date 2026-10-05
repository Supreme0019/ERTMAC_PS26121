import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, FileText, Database, Layers, RefreshCw, CheckCircle, 
  AlertCircle, Loader2, Clock, Calendar, Hash, HardDrive, 
  User, ShieldCheck, ExternalLink, ChevronRight
} from 'lucide-react';
import { documentsAPI } from '../../api/client';
import ChunkViewer from './ChunkViewer';
import EntityViewer from './EntityViewer';
import PdfViewer from './PdfViewer';

export default function DocumentDrawer({ docId, onClose, onReprocess }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, chunks, entities
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessSuccess, setReprocessSuccess] = useState(false);
  const [chunkCount, setChunkCount] = useState(null);
  const [entityCount, setEntityCount] = useState(null);

  useEffect(() => {
    if (docId) {
      fetchDocDetails();
      fetchQuickCounts();
    }
  }, [docId]);

  async function fetchDocDetails() {
    setLoading(true);
    try {
      const { data } = await documentsAPI.getById(docId);
      const docData = data.data?.document || data.data || null;
      setDoc(docData);
    } catch (err) {
      console.error('Failed to fetch document metadata:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchQuickCounts() {
    try {
      const [chunksRes, entitiesRes] = await Promise.all([
        documentsAPI.getChunks(docId).catch(() => ({ data: {} })),
        documentsAPI.getEntities(docId).catch(() => ({ data: {} })),
      ]);
      const chunks = chunksRes.data?.data?.chunks || chunksRes.data?.data || [];
      const entities = entitiesRes.data?.data?.entities || entitiesRes.data?.data || [];
      setChunkCount(Array.isArray(chunks) ? chunks.length : 0);
      setEntityCount(Array.isArray(entities) ? entities.length : 0);
    } catch (e) {
      // ignore quick count errors
    }
  }

  async function handleReprocess() {
    setReprocessing(true);
    setReprocessSuccess(false);
    try {
      await documentsAPI.reprocess(docId);
      setReprocessSuccess(true);
      await Promise.all([fetchDocDetails(), fetchQuickCounts()]);
      if (onReprocess) onReprocess();
      setTimeout(() => setReprocessSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to reprocess document:', err);
    } finally {
      setReprocessing(false);
    }
  }

  const getStatusBadge = (status) => {
    const s = String(status || 'completed').toLowerCase();
    switch (s) {
      case 'completed':
      case 'processed':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={13} /> Indexed
          </span>
        );
      case 'processing':
        return (
          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Loader2 size={13} className="spin" /> Ingesting
          </span>
        );
      case 'failed':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={13} /> Failed
          </span>
        );
      default:
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={13} /> Pending
          </span>
        );
    }
  };

  const filename = doc?.original_filename || doc?.original_name || 'OIL Drilling Document';

  return (
    <motion.div 
      className="drawer-overlay"
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: 'rgba(26, 35, 51, 0.45)', 
        backdropFilter: 'blur(3px)',
        zIndex: 1000, 
        display: 'flex', 
        justifyContent: 'flex-end' 
      }}
      onClick={onClose}
    >
      <motion.div 
        className="drawer-content"
        initial={{ x: '100%' }} 
        animate={{ x: 0 }} 
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        style={{ 
          width: '740px', 
          height: '100%', 
          maxWidth: '94vw', 
          backgroundColor: 'var(--color-bg-primary)', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.15)',
          borderLeft: '1px solid var(--color-border)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div 
          style={{ 
            padding: '18px 24px', 
            borderBottom: '1px solid var(--color-border)', 
            backgroundColor: 'var(--color-bg-card)',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div 
              style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '8px', 
                background: 'linear-gradient(135deg, var(--color-sidebar-bg) 0%, #5a3d28 100%)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#fff',
                flexShrink: 0
              }}
            >
              <FileText size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 
                  style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 700, 
                    color: 'var(--color-text-heading)', 
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '420px'
                  }}
                  title={filename}
                >
                  {filename}
                </h2>
                {doc && getStatusBadge(doc.processing_status || doc.ocr_status)}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span>Well: <strong style={{ color: 'var(--color-sidebar-bg)' }}>{doc?.well_name || 'NWIS-DEMO-01'}</strong></span>
                <span>•</span>
                <span style={{ textTransform: 'capitalize' }}>{doc?.document_type?.replace(/_/g, ' ') || 'Report'}</span>
              </div>
            </div>
          </div>

          <button 
            className="btn btn-ghost btn-icon" 
            onClick={onClose} 
            title="Close Drawer"
            style={{ borderRadius: '50%', width: '36px', height: '36px', flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 3-Way Inspection Tabs */}
        <div 
          style={{ 
            display: 'flex', 
            borderBottom: '1px solid var(--color-border)', 
            backgroundColor: 'var(--color-bg-secondary)',
            padding: '0 24px',
            gap: '8px'
          }}
        >
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '3px solid var(--color-sidebar-bg)' : '3px solid transparent',
              color: activeTab === 'overview' ? 'var(--color-sidebar-bg)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'overview' ? 700 : 500,
              fontSize: '0.86rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={15} /> Overview & Preview
          </button>

          <button
            className={`tab-btn ${activeTab === 'chunks' ? 'active' : ''}`}
            onClick={() => setActiveTab('chunks')}
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'chunks' ? '3px solid var(--color-sidebar-bg)' : '3px solid transparent',
              color: activeTab === 'chunks' ? 'var(--color-sidebar-bg)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'chunks' ? 700 : 500,
              fontSize: '0.86rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Database size={15} /> Document Sections {chunkCount !== null && `(${chunkCount})`}
          </button>

          <button
            className={`tab-btn ${activeTab === 'entities' ? 'active' : ''}`}
            onClick={() => setActiveTab('entities')}
            style={{
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'entities' ? '3px solid var(--color-sidebar-bg)' : '3px solid transparent',
              color: activeTab === 'entities' ? 'var(--color-sidebar-bg)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'entities' ? 700 : 500,
              fontSize: '0.86rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Layers size={15} /> Parameters & Data {entityCount !== null && `(${entityCount})`}
          </button>
        </div>

        {/* Drawer Body Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
              <Loader2 size={36} className="spin" style={{ color: 'var(--color-sidebar-bg)' }} />
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>Loading document intelligence...</div>
            </div>
          ) : doc ? (
            <>
              {/* TAB 1: OVERVIEW & PDF / FILE PREVIEW */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Status Banner / Reprocess feedback */}
                  {reprocessSuccess && (
                    <div 
                      style={{ 
                        backgroundColor: 'rgba(52, 211, 153, 0.15)', 
                        border: '1px solid var(--color-accent-emerald)', 
                        borderRadius: 'var(--radius-md)', 
                        padding: '12px 16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        color: 'var(--color-accent-emerald)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <CheckCircle size={16} /> Document record re-indexed successfully.
                    </div>
                  )}

                  {/* Document Technical Metadata Matrix */}
                  <div 
                    className="card" 
                    style={{ 
                      padding: '20px', 
                      backgroundColor: 'var(--color-bg-card)', 
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '10px' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-heading)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} style={{ color: 'var(--color-sidebar-bg)' }} /> Document Specifications & Record Details
                      </h3>

                      <button 
                        className="btn btn-secondary btn-xs" 
                        onClick={handleReprocess} 
                        disabled={reprocessing}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <RefreshCw size={13} className={reprocessing ? 'spin' : ''} /> 
                        {reprocessing ? 'Syncing...' : 'Re-index Record'}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '0.85rem' }}>
                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Document Title</div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px', wordBreak: 'break-word' }}>
                          {doc.original_filename || doc.original_name}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Well Reference</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-sidebar-bg)', marginTop: '2px' }}>
                          {doc.well_name || 'N/A'}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Document Category</div>
                        <div style={{ textTransform: 'capitalize', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          {doc.document_type?.replace(/_/g, ' ') || 'Report'}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Pages</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          {doc.page_count ?? doc.pages ?? 1} pages
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Text Length</div>
                        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          {doc.text_length ? `${(doc.text_length / 1024).toFixed(1)} KB (${doc.text_length.toLocaleString()} characters)` : '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Archival Status</div>
                        <div style={{ marginTop: '2px' }}>
                          {getStatusBadge(doc.ocr_status || doc.processing_status)}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Date Logged</div>
                        <div style={{ color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          {doc.document_date || doc.created_at ? new Date(doc.document_date || doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Logged By</div>
                        <div style={{ color: 'var(--color-text-primary)', marginTop: '2px' }}>
                          {doc.uploader_name || 'Rajesh Kumar (Drilling Eng)'}
                        </div>
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>File Checksum (SHA-256)</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--color-text-secondary)', marginTop: '2px', backgroundColor: 'var(--color-bg-primary)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border-light)' }}>
                          {doc.checksum || 'abcd1234efgh5678ijkl9012mnop3456'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Document / PDF Technical Preview Sheet */}
                  <PdfViewer doc={doc} />
                </div>
              )}

              {/* TAB 2: SEMANTIC VECTOR CHUNKS */}
              {activeTab === 'chunks' && (
                <ChunkViewer docId={docId} />
              )}

              {/* TAB 3: EXTRACTED GEOLOGICAL & OPERATIONAL ENTITIES */}
              {activeTab === 'entities' && (
                <EntityViewer docId={docId} />
              )}
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Document details not found.
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
