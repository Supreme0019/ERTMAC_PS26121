export const normalizeWell = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status || 'UNKNOWN',
    type: raw.type || 'UNKNOWN',
    latitude: raw.latitude,
    longitude: raw.longitude,
    currentDepth: raw.current_depth,
    targetDepth: raw.target_depth,
    spudDate: raw.spud_date,
    lastUpdate: raw.updated_at || raw.last_update,
    ...raw
  };
};

export const normalizeRisk = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    wellId: raw.well_id,
    riskType: raw.risk_type,
    level: raw.level,
    probability: raw.probability,
    severity: raw.severity,
    status: raw.status,
    description: raw.description,
    mitigation: raw.mitigation,
    identifiedAt: raw.identified_at,
    resolvedAt: raw.resolved_at,
    ...raw
  };
};

export const normalizeAlert = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    wellId: raw.well_id,
    parameter: raw.parameter,
    severity: raw.severity,
    message: raw.message,
    value: raw.value,
    threshold: raw.threshold,
    isAcknowledged: raw.is_acknowledged,
    timestamp: raw.timestamp || raw.created_at,
    ...raw
  };
};

export const normalizeEvent = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    wellId: raw.well_id,
    eventType: raw.event_type,
    depth: raw.depth,
    severity: raw.severity,
    description: raw.description,
    timestamp: raw.timestamp || raw.created_at,
    ...raw
  };
};

export const normalizeDocument = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    wellId: raw.well_id,
    fileName: raw.file_name,
    fileType: raw.file_type,
    fileSize: raw.file_size,
    status: raw.status,
    uploadedBy: raw.uploaded_by,
    uploadedAt: raw.uploaded_at || raw.created_at,
    ...raw
  };
};

export const normalizeParameter = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    wellId: raw.well_id,
    timestamp: raw.timestamp,
    depth: raw.depth,
    wob: raw.wob,
    rpm: raw.rpm,
    torque: raw.torque,
    standpipePressure: raw.standpipe_pressure,
    flowRate: raw.flow_rate,
    rop: raw.rop,
    ...raw
  };
};
