export const ROLES = {
  DRILLING_ENGINEER: 'DRILLING_ENGINEER',
  SUPERVISOR: 'SUPERVISOR',
  FIELD_PERSONNEL: 'FIELD_PERSONNEL',
  DATA_ADMIN: 'DATA_ADMIN',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  AI_ADMIN: 'AI_ADMIN',
};

const ROLE_PERMISSIONS = {
  [ROLES.DRILLING_ENGINEER]: ['view_wells', 'view_realtime', 'view_reports', 'edit_parameters', 'manage_events'],
  [ROLES.SUPERVISOR]: ['view_wells', 'view_realtime', 'view_reports', 'approve_changes', 'view_all_teams'],
  [ROLES.FIELD_PERSONNEL]: ['view_wells', 'view_realtime', 'add_logs'],
  [ROLES.DATA_ADMIN]: ['view_wells', 'manage_documents', 'edit_parameters', 'manage_events', 'manage_formations'],
  [ROLES.SYSTEM_ADMIN]: ['view_wells', 'manage_users', 'manage_system_settings', 'view_audit_logs', 'view_realtime', 'view_reports', 'edit_parameters', 'manage_events', 'manage_documents', 'manage_formations', 'approve_changes', 'view_all_teams'],
  [ROLES.AI_ADMIN]: ['view_wells', 'view_realtime', 'view_reports', 'manage_documents', 'manage_formations', 'view_all_teams', 'view_audit_logs'],
};

export const getPermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

export const hasPermission = (role, capability) => {
  if (Array.isArray(capability)) {
    return capability.some(cap => getPermissions(role).includes(cap));
  }
  return getPermissions(role).includes(capability);
};
