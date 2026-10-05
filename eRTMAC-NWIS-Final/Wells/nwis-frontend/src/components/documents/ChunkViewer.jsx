import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentsAPI } from '../../api/client';
import { Database, Search, Copy, Check, Sparkles, FileText, ArrowRight, Loader2 } from 'lucide-react';

export default function ChunkViewer({ docId }) {
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chunkFilter, setChunkFilter] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchChunks() {
      if (!docId) return;
      setLoading(true);
      try {
        const { data } = await documentsAPI.getChunks(docId);
        const list = data.data?.chunks || data.data || [];
        setChunks(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to fetch chunks:', err);
        setChunks([]);
      } finally {
        setLoading(false);
      }
    }
    fetchChunks();
  }, [docId]);

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAskAssistant = (chunkText) => {
    const query = chunkText.slice(0, 180).trim();
    navigate(`/assistant?q=${encodeURIComponent(query)}`);
  };

  const filteredChunks = chunks.filter(c => {
    if (!chunkFilter) return true;
    const term = chunkFilter.toLowerCase();
    return (
      c.text?.toLowerCase().includes(term) ||
      c.section?.toLowerCase().includes(term) ||
      String(c.page || c.chunk_index).includes(term)
    );
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--color-sidebar-bg)' }} />
        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          Retrieving semantic vector chunks...
        </span>
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="card" style={{ padding: '32px', textAlign: 'center', border: '1px dashed var(--color-border)' }}>
        <Database size={36} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px' }} />
        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
          No Vector Chunks Found
        </h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', maxWidth: '360px', margin: '0 auto' }}>
          This document has not been chunked yet or OCR extraction is still generating semantic passages.
        </p>
      </div>
    );
  }

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
            <Database size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-heading)' }}>
              {chunks.length} Extracted Document Sections
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              Cataloged excerpts from original report pages for cross-referencing and search
            </div>
          </div>
        </div>

        <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
          Verified Text
        </span>
      </div>

      {/* Filter / Search within chunks */}
      {chunks.length > 1 && (
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search within report text..."
            value={chunkFilter}
            onChange={(e) => setChunkFilter(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
          />
        </div>
      )}

      {/* Chunk Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredChunks.map((chunk, index) => {
          const chunkId = chunk.id || `chunk-${index}`;
          const chunkText = chunk.text || chunk.content || '';
          const isCopied = copiedId === chunkId;

          return (
            <div 
              key={chunkId} 
              className="card" 
              style={{ 
                padding: '16px', 
                backgroundColor: 'var(--color-bg-card)', 
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span 
                    style={{ 
                      fontSize: '0.78rem', 
                      fontWeight: 700, 
                      backgroundColor: 'var(--color-bg-secondary)', 
                      color: 'var(--color-text-primary)', 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    Section {chunk.chunk_index !== undefined ? chunk.chunk_index + 1 : index + 1}
                  </span>

                  {(chunk.page || chunk.page_number) && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={12} /> Page {chunk.page || chunk.page_number}
                    </span>
                  )}

                  {chunk.section && (
                    <span className="badge badge-neutral" style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>
                      {chunk.section}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleCopy(chunkId, chunkText)}
                    title="Copy section text"
                    style={{ padding: '4px 6px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {isCopied ? <Check size={13} style={{ color: 'var(--color-success)' }} /> : <Copy size={13} />}
                    {isCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Chunk Text Body */}
              <div 
                style={{ 
                  fontSize: '0.86rem', 
                  lineHeight: '1.65', 
                  color: 'var(--color-text-primary)',
                  backgroundColor: 'var(--color-bg-primary)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-light)',
                  fontFamily: 'var(--font-sans)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {chunkText}
              </div>

              {/* Footer Info & Action */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--color-border-light)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {chunkText.length} characters
                </span>

                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => handleAskAssistant(chunkText)}
                  style={{ 
                    fontSize: '0.76rem', 
                    color: 'var(--color-sidebar-bg)', 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    fontWeight: 600,
                    padding: '2px 6px'
                  }}
                >
                  Query in Assistant <ArrowRight size={12} />
                </button>
              </div>
            </div>
          );
        })}

        {filteredChunks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            No chunks match "{chunkFilter}".
          </div>
        )}
      </div>
    </div>
  );
}
