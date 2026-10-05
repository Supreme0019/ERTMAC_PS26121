import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';
import { alertsAPI } from '../../api/client';

export default function LiveAlertPanel({ alerts = [] }) {
  const getSeverityColor = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#38bdf8';
      default: return '#8b99b8';
    }
  };

  const handleAck = async (id) => {
    try {
      await alertsAPI.acknowledge(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolve = async (id) => {
    try {
      await alertsAPI.resolve(id);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <AnimatePresence>
          {alerts.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '24px', fontSize: '0.85rem' }}>
              No active alerts.
            </div>
          ) : (
            alerts.map((alert) => (
              <motion.div 
                key={alert.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{ 
                  background: 'var(--color-background)', 
                  border: `1px solid ${getSeverityColor(alert.severity)}40`,
                  borderLeft: `3px solid ${getSeverityColor(alert.severity)}`,
                  borderRadius: '6px',
                  padding: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} color={getSeverityColor(alert.severity)} />
                    {alert.alert_type?.replace(/_/g, ' ') || 'Alert'}
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '12px', background: `${getSeverityColor(alert.severity)}20`, color: getSeverityColor(alert.severity), textTransform: 'uppercase' }}>
                    {alert.status || 'NEW'}
                  </span>
                </div>
                
                <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                  {alert.message || 'No details provided.'}
                </p>

                {alert.status !== 'resolved' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {alert.status !== 'acknowledged' && (
                      <button 
                        onClick={() => handleAck(alert.id)}
                        className="btn btn-sm btn-ghost" 
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      >
                        Acknowledge
                      </button>
                    )}
                    <button 
                      onClick={() => handleResolve(alert.id)}
                      className="btn btn-sm btn-primary" 
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
