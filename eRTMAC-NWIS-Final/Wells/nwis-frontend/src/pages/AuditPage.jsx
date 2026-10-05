import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { auditAPI } from '../api/client';
import { RoleGate } from '../components/auth/RoleGate';
import { Search } from 'lucide-react';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ user: '', action: '', resource: '' });

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const { data } = await auditAPI.getLogs(filters);
        setLogs(data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [filters]);

  return (
    <RoleGate requirePermission="view_audit">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="page-header">
          <h1 className="page-title">System <span className="text-gradient">Audit Logs</span></h1>
          <p className="page-subtitle">Track user actions and system changes</p>
        </div>

        <div className="card" style={{ marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="label">User</label>
            <input type="text" className="input" placeholder="Filter by user..." value={filters.user} onChange={e => setFilters({...filters, user: e.target.value})} />
          </div>
          <div>
            <label className="label">Action</label>
            <input type="text" className="input" placeholder="e.g. create, delete..." value={filters.action} onChange={e => setFilters({...filters, action: e.target.value})} />
          </div>
          <div>
            <label className="label">Resource Type</label>
            <input type="text" className="input" placeholder="e.g. well, document..." value={filters.resource} onChange={e => setFilters({...filters, resource: e.target.value})} />
          </div>
          <button className="btn btn-primary" onClick={() => setFilters({...filters})}><Search size={16} /> Filter</button>
        </div>

        {loading ? (
          <div className="spinner-overlay" style={{ height: '300px', position: 'relative' }}><div className="spinner"></div></div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            {logs.length === 0 ? (
               <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No audit logs found.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id || i}>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>{new Date(log.created_at || log.timestamp).toLocaleString()}</td>
                      <td style={{ fontWeight: 500 }}>{log.user_id || log.user}</td>
                      <td><span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>{log.action}</span></td>
                      <td style={{ textTransform: 'capitalize' }}>{log.resource_type || log.resource}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(log.details || {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </motion.div>
    </RoleGate>
  );
}
