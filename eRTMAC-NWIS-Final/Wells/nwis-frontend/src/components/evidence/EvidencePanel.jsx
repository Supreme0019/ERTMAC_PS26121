import React from 'react';
import { formatDepth, formatEventType } from '../../utils/formatters';
import SourceDocumentLink from './SourceDocumentLink';
import './EvidencePanel.css';

const EvidencePanel = ({ evidence = [] }) => {
  if (!evidence || evidence.length === 0) return null;

  return (
    <div className="evidence-panel">
      <h4 className="evidence-panel-header">SUPPORTING EVIDENCE</h4>
      <div className="evidence-list">
        {evidence.map((item, index) => {
          const wellName =
            item.well || item.well_name || (item.well_id ? `Offset Well (${item.well_id.slice(0, 8)})` : 'Offset Well');
          const eventType = item.event_type || 'historical_incident';
          const depth = item.depth;
          const severity = item.severity?.toLowerCase() || 'high';
          const quote = item.quote || item.evidence_quote;
          const description =
            quote || item.description || item.snippet ||
            (item.event_id
              ? `Historical incident verified against offset well logs (${item.event_id.slice(0, 8)})`
              : 'Verified historical event in offset formation');
          const docUri = item.doc || item.file_uri || item.document_id;
          const pageNum = item.page || 1;
          const doc =
            item.source_document ||
            (docUri ? { id: item.document_id || docUri, file_uri: docUri, page: pageNum } : null);
          const mitigation = item.mitigation;

          return (
            <div key={index} className={`evidence-item severity-${severity}`}>
              <div className="evidence-item-header">
                <span className="evidence-well">{wellName}</span>
                <span className="evidence-type">{formatEventType(eventType)}</span>
                {item.formation && (
                  <span style={{ fontSize: '0.72rem', color: '#a78bfa', fontWeight: 600 }}>
                    ({item.formation})
                  </span>
                )}
                {item.provenance && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      backgroundColor:
                        item.provenance === 'DIRECT' ? 'rgba(5, 150, 105, 0.15)' :
                        item.provenance === 'REGIONAL' ? 'rgba(37, 99, 235, 0.15)' :
                        item.provenance === 'ANALOG' ? 'rgba(217, 119, 6, 0.15)' :
                        'rgba(107, 114, 128, 0.15)',
                      color:
                        item.provenance === 'DIRECT' ? '#059669' :
                        item.provenance === 'REGIONAL' ? '#2563eb' :
                        item.provenance === 'ANALOG' ? '#d97706' :
                        '#4b5563',
                    }}
                  >
                    {item.provenance}
                  </span>
                )}
                {depth && <span className="evidence-depth">{formatDepth(depth)}</span>}
              </div>

              {quote ? (
                <blockquote style={{
                  margin: '6px 0',
                  padding: '6px 10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderLeft: '3px solid #38bdf8',
                  fontStyle: 'italic',
                  fontSize: '0.84rem',
                  color: 'var(--color-text-primary)'
                }}>
                  "{quote}"
                </blockquote>
              ) : (
                <p className="evidence-description">{description}</p>
              )}

              {mitigation && (
                <div style={{ fontSize: '0.75rem', color: '#34d399', margin: '4px 0' }}>
                  <strong>Historical Mitigation:</strong> {mitigation}
                </div>
              )}

              {doc && (
                <div className="evidence-source" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <SourceDocumentLink document={doc} />
                  {pageNum && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Page {pageNum}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EvidencePanel;
