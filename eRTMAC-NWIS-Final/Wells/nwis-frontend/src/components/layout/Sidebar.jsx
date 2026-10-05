// =============================================================================
// NWIS Frontend — Sidebar Navigation
// =============================================================================

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, MapPin, Layers, FileText, Search,
  AlertTriangle, Activity, BarChart3, MessageSquare,
  Settings, Shield, ChevronLeft, ChevronRight, Droplets, Box, Compass, ShieldCheck
} from 'lucide-react';
import { useState } from 'react';
import './Sidebar.css';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard', id: 'nav-dashboard' },
  { path: '/wells', icon: MapPin, label: 'Wells', id: 'nav-wells' },
  { path: '/planning', icon: Compass, label: 'Well Planning', id: 'nav-planning' },
  { path: '/map', icon: Layers, label: 'GIS Map', id: 'nav-map' },
  { path: '/documents', icon: FileText, label: 'Documents', id: 'nav-documents' },
  { path: '/search', icon: Search, label: 'Search', id: 'nav-search' },
  { path: '/risks', icon: AlertTriangle, label: 'Risk Analysis', id: 'nav-risks' },
  { path: '/realtime', icon: Activity, label: 'Real-Time', id: 'nav-realtime' },
  { path: '/simulation', icon: Box, label: '3D Simulation', id: 'nav-simulation' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics', id: 'nav-analytics' },
  { path: '/assistant', icon: MessageSquare, label: 'AI Assistant', id: 'nav-assistant' },
];

const bottomItems = [
  { path: '/drift', icon: ShieldCheck, label: 'Model Drift', id: 'nav-drift' },
  { path: '/audit', icon: Shield, label: 'Audit Log', id: 'nav-audit' },
  { path: '/settings', icon: Settings, label: 'Settings', id: 'nav-settings' },
];

export default function Sidebar({ collapsed: propCollapsed, setCollapsed: propSetCollapsed }) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = propCollapsed !== undefined ? propCollapsed : internalCollapsed;
  const setCollapsed = propSetCollapsed !== undefined ? propSetCollapsed : setInternalCollapsed;

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Droplets size={22} />
        </div>
        {!collapsed && (
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">eRTMAC-NWIS</span>
            <span className="sidebar-logo-subtitle">Well Intelligence</span>
          </div>
        )}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          id="sidebar-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-nav-group">
          {!collapsed && <span className="sidebar-nav-label">Main</span>}
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              id={item.id}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              end={item.path === '/'}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="sidebar-link-icon" />
              {!collapsed && <span className="sidebar-link-text">{item.label}</span>}
              {item.path === '/risks' && !collapsed && (
                <span className="sidebar-badge badge badge-danger">3</span>
              )}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-nav-group sidebar-nav-bottom">
          {!collapsed && <span className="sidebar-nav-label">System</span>}
          {bottomItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              id={item.id}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={18} className="sidebar-link-icon" />
              {!collapsed && <span className="sidebar-link-text">{item.label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Status */}
      {!collapsed && (
        <div className="sidebar-status">
          <div className="sidebar-status-dot"></div>
          <span>Backend Connected</span>
        </div>
      )}
    </aside>
  );
}
