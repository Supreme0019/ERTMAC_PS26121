// =============================================================================
// NWIS Frontend — Stat Card Component
// =============================================================================

import { motion } from 'framer-motion';
import './StatCard.css';

export default function StatCard({ icon: Icon, label, value, change, changeType, color = 'cyan', onClick }) {
  return (
    <motion.div
      className={`stat-card stat-card-${color}`}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
    >
      <div className="stat-card-header">
        <div className={`stat-card-icon stat-card-icon-${color}`}>
          {Icon && <Icon size={20} />}
        </div>
        {change !== undefined && (
          <span className={`stat-card-change stat-card-change-${changeType || 'neutral'}`}>
            {changeType === 'up' ? '↑' : changeType === 'down' ? '↓' : ''} {change}
          </span>
        )}
      </div>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </motion.div>
  );
}
