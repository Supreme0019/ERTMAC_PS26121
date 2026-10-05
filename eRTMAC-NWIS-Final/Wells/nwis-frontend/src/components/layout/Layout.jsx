// =============================================================================
// NWIS Frontend — Main Layout Shell
// =============================================================================

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './Layout.css';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`layout ${collapsed ? 'layout-collapsed' : ''}`}
      style={{ '--sidebar-width': collapsed ? '68px' : '248px' }}
    >
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="layout-main">
        <Topbar collapsed={collapsed} />
        <main className="layout-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
