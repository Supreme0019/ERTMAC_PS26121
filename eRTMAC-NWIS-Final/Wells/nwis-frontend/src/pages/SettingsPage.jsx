import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../api/client';
import { RoleGate } from '../components/auth/RoleGate';
import { User, LogOut, Shield, Plus, Edit } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        try {
          const { data } = await usersAPI.getAll();
          setUsers(data.data || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [user]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-header">
        <h1 className="page-title">Account <span className="text-gradient">Settings</span></h1>
        <p className="page-subtitle">Manage your profile and system preferences</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><User size={18} /> Profile Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px', alignItems: 'center' }}>
          <div style={{ color: 'var(--color-text-muted)' }}>Name:</div>
          <div style={{ fontWeight: 500 }}>{user?.name || 'Unknown User'}</div>
          
          <div style={{ color: 'var(--color-text-muted)' }}>Email:</div>
          <div>{user?.email || 'N/A'}</div>
          
          <div style={{ color: 'var(--color-text-muted)' }}>Role:</div>
          <div><span className="badge badge-primary" style={{ textTransform: 'uppercase' }}>{user?.role || 'user'}</span></div>
          
          <div style={{ color: 'var(--color-text-muted)' }}>Status:</div>
          <div><span className="badge badge-success">Active</span></div>
        </div>
        <div style={{ marginTop: '24px' }}>
          <button className="btn btn-danger" onClick={logout}><LogOut size={16} /> Sign Out</button>
        </div>
      </div>

      <RoleGate requirePermission="manage_users">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> User Management</h3>
            <button className="btn btn-primary btn-sm"><Plus size={14} /> Add User</button>
          </div>
          
          {loading ? (
            <div className="spinner-overlay" style={{ height: '200px', position: 'relative' }}><div className="spinner"></div></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{u.email}</td>
                      <td><span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>{u.role}</span></td>
                      <td><span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{u.status || 'active'}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Edit User"><Edit size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </RoleGate>
    </motion.div>
  );
}
