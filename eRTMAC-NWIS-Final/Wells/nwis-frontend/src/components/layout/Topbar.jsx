// =============================================================================
// NWIS Frontend — Topbar
// =============================================================================

import { Bell, Search, User, LogOut, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Topbar.css';

export default function Topbar() {
  const { user, logout } = useAuth();
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-search">
          <Search size={16} className="topbar-search-icon" />
          <input
            type="text"
            placeholder="Search wells, documents, events..."
            className="input topbar-search-input"
            id="global-search"
            onFocus={() => navigate('/search')}
          />
          <kbd className="topbar-kbd">⌘K</kbd>
        </div>
        <div className="topbar-badge-wrap">
          <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '4px 8px', letterSpacing: '0.5px' }}>
            DATA MODE: DEMO / SIMULATION
          </span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Notifications */}
        <button className="btn btn-ghost btn-icon topbar-bell" id="btn-notifications" title="Notifications">
          <Bell size={18} />
          <span className="topbar-bell-dot"></span>
        </button>

        {/* User Menu */}
        {user ? (
          <div className="topbar-user" ref={menuRef}>
            <button
              className="topbar-user-btn"
              onClick={() => setUserMenu(!userMenu)}
              id="btn-user-menu"
            >
              <div className="topbar-avatar">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="topbar-user-info">
                <span className="topbar-user-name">{user.name || 'User'}</span>
                <span className="topbar-user-role">{user.role || 'engineer'}</span>
              </div>
              <ChevronDown size={14} className={`topbar-chevron ${userMenu ? 'open' : ''}`} />
            </button>

            {userMenu && (
              <div className="topbar-dropdown">
                <button className="topbar-dropdown-item" onClick={() => { navigate('/settings'); setUserMenu(false); }}>
                  <User size={15} /> Profile & Settings
                </button>
                <div className="topbar-dropdown-divider"></div>
                <button className="topbar-dropdown-item topbar-dropdown-danger" onClick={handleLogout}>
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')} id="btn-login">
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
