import { useAuth } from '../contexts/AuthContext';
import { hasPermission as checkPermission } from '../utils/permissions';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  const hasPermission = (capability) => {
    if (!role) return false;
    return checkPermission(role, capability);
  };

  return { hasPermission, role };
}
