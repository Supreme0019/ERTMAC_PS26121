import { useAuth } from '../../contexts/AuthContext';
import { hasPermission } from '../../utils/permissions';

export function RoleGate({ children, requires, fallback = null }) {
  const { user } = useAuth();

  if (!user || !user.role) {
    return fallback;
  }

  const isAllowed = hasPermission(user.role, requires);

  if (!isAllowed) {
    return fallback;
  }

  return children;
}
