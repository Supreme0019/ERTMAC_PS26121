// =============================================================================
// NWIS Frontend — Search Normalizer
// =============================================================================

export function normalizeSearchResult(item) {
  // If the backend already returns type-annotated normalized items, use them, but ensure standard fields
  const type = item.type || item._index || item.document_type || 'unknown';
  
  let title = item.title || item.name || item.well_name || item.original_name || 'Unknown';
  let subtitle = item.subtitle || item.description || '';
  
  if (type === 'well' || type === 'wells') {
    title = item.well_name || item.title || 'Unknown Well';
    subtitle = item.field ? `${item.field} Field — ${item.status || 'Unknown status'}` : subtitle;
  } else if (type === 'document' || type === 'documents' || type === 'document_chunk') {
    title = item.original_name || item.title || 'Document';
    subtitle = item.well_name ? `Well: ${item.well_name}` : subtitle;
  } else if (type === 'event' || type === 'events') {
    title = item.event_type ? item.event_type.replace(/_/g, ' ') : item.title || 'Event';
    subtitle = `${item.well_name || 'Unknown well'} • ${item.severity || 'Unknown severity'}`;
  } else if (type === 'formation' || type === 'formations') {
    title = item.formation_name || item.title || 'Formation';
    subtitle = item.lithology || subtitle;
  }
  
  return {
    ...item,
    type: type.replace(/s$/, '').replace('_chunk', ''), // singularize type
    title,
    subtitle,
    id: item.id || item._id,
    score: item.score || item._score || null,
  };
}
