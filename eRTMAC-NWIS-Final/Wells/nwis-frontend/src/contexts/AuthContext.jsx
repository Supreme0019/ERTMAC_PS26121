// =============================================================================
// NWIS Frontend — Auth Context
// =============================================================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('nwis_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authAPI.me();
      setUser(data.data);
    } catch {
      localStorage.removeItem('nwis_token');
      localStorage.removeItem('nwis_refresh_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('nwis_token', data.data.accessToken);
    if (data.data.refreshToken) {
      localStorage.setItem('nwis_refresh_token', data.data.refreshToken);
    }
    setUser(data.data.user);
    return data.data.user;
  };

  const register = async (userData) => {
    const { data } = await authAPI.register(userData);
    localStorage.setItem('nwis_token', data.data.accessToken);
    if (data.data.refreshToken) {
      localStorage.setItem('nwis_refresh_token', data.data.refreshToken);
    }
    setUser(data.data.user);
    return data.data.user;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch { /* ignore */ }
    localStorage.removeItem('nwis_token');
    localStorage.removeItem('nwis_refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
