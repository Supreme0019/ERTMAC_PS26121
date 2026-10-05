export const formatDepth = (val) => {
  if (val === null || val === undefined) return '- m';
  return `${Number(val).toLocaleString()} m`;
};

export const formatDistance = (val) => {
  if (val === null || val === undefined) return '- km';
  return `${Number(val).toLocaleString()} km`;
};

export const formatScore = (val) => {
  if (val === null || val === undefined) return '- %';
  return `${Math.round(Number(val) * 100)}%`;
};

export const formatRiskLevel = (level) => {
  if (!level) return 'UNKNOWN';
  return level.toString().toUpperCase();
};

export const formatEventType = (type) => {
  if (!type) return 'Unknown Event';
  // Simple capitalization or mapping
  return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

export const formatTimestamp = (ts) => {
  if (!ts) return '-';
  const date = new Date(ts);
  return date.toLocaleString();
};
