// =============================================================================
// NWIS Frontend — Login Page
// =============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Droplets, LogIn, UserPlus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'drilling_engineer',
  });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        await register(form);
      } else {
        await login(form.email, form.password);
      }
      navigate('/');
    } catch (err) {
      const serverMsg = err.response?.data?.error?.message || err.response?.data?.message;
      if (serverMsg) {
        setError(serverMsg);
      } else if (!err.response || err.code === 'ERR_NETWORK') {
        setError('Cannot connect to the backend server. Please verify backend is running on port 4001.');
      } else {
        setError('Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Background Animation */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb-1"></div>
        <div className="login-bg-orb login-bg-orb-2"></div>
        <div className="login-bg-orb login-bg-orb-3"></div>
      </div>

      <motion.div
        className="login-card glass"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Droplets size={28} />
          </div>
          <h1 className="login-title">eRTMAC-NWIS</h1>
          <p className="login-subtitle">Nearby Wells Intelligence System</p>
          <p className="login-org">Oil India Limited • SIH 2026</p>
        </div>

        {/* Error */}
        {error && (
          <motion.div className="login-error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <AlertCircle size={16} /> {error}
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <div className="login-field">
              <label className="label" htmlFor="name">Full Name</label>
              <input
                type="text"
                className="input"
                name="name"
                id="name"
                placeholder="Enter your full name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className="login-field">
            <label className="label" htmlFor="email">Email Address</label>
            <input
              type="email"
              className="input"
              name="email"
              id="email"
              placeholder="engineer@oilindia.in"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="login-field">
            <label className="label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                name="password"
                id="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div className="login-field">
              <label className="label" htmlFor="role">Role</label>
              <select className="input select" name="role" id="role" value={form.role} onChange={handleChange}>
                <option value="drilling_engineer">Drilling Engineer</option>
                <option value="field_personnel">Field Personnel</option>
                <option value="supervisor">Supervisor</option>
                <option value="data_admin">Data Admin</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn btn-primary login-submit" disabled={loading} id="btn-submit">
            {loading ? 'Processing...' : isRegister ? (
              <><UserPlus size={16} /> Create Account</>
            ) : (
              <><LogIn size={16} /> Sign In</>
            )}
          </button>
        </form>

        <div className="login-toggle">
          <span>{isRegister ? 'Already have an account?' : "Don't have an account?"}</span>
          <button
            className="login-toggle-btn"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            id="btn-toggle-auth"
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </div>

        <div className="login-demo">
          <span className="login-demo-label">Quick Demo Access (Autofill)</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, email: 'rajesh.kumar@ongc.demo', password: 'NwisDemo2026!' })}>
              Drilling Engineer
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, email: 'priya.sharma@ongc.demo', password: 'NwisDemo2026!' })}>
              Supervisor
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, email: 'amit.patel@ongc.demo', password: 'NwisDemo2026!' })}>
              Data Admin
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, email: 'admin@nwis.demo', password: 'NwisDemo2026!' })}>
              System Admin
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
