import React from 'react';
import { FileText } from 'lucide-react';
import './SourceDocumentLink.css';

const SourceDocumentLink = ({ document }) => {
  if (!document) return null;

  const handleOpen = (e) => {
    e.preventDefault();
    // Extract just the filename from any path (e.g. data/reports/SYN-001_ddr.pdf → SYN-001_ddr.pdf)
    const rawUri = document.original_filename || document.file_uri || document.name || document.id || '';
    const filename = rawUri.split('/').pop().split('\\').pop();
    if (!filename) return;

    let url = `/api/documents/file/${encodeURIComponent(filename)}`;
    const page = document.page || null;
    if (page) url += `#page=${page}`;
    window.open(url, '_blank');
  };

  const displayName = document.original_filename || document.name || document.file_uri || 'Source Document';
  const shortName = displayName.split('/').pop().split('\\').pop();

  return (
    <a href="#" className="source-document-link" onClick={handleOpen} title={shortName}>
      <FileText size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
      <span style={{ color: '#2563eb' }}>{shortName}</span>
      {document.page ? <span style={{ color: '#6b7280' }}> (p. {document.page})</span> : null}
    </a>
  );
};

export default SourceDocumentLink;
