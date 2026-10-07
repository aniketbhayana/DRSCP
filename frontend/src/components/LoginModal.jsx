import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ portalType, onBack, onLoginSuccess }) {
  const { login } = useAuth();
  const isAdmin = portalType === 'admin';

  const [username, setUsername] = useState(isAdmin ? 'admin_chennai' : 'req_kavitha');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const demoAccounts = isAdmin
    ? [
        { user: 'admin_chennai', role: 'ADMIN', label: 'Chennai Admin' },
        { user: 'manager_tnsdma', role: 'AGENCY_MANAGER', label: 'TNSDMA Manager' },
      ]
    : [
        { user: 'req_kavitha', role: 'REQUESTER', label: 'Kavitha (Citizen)' },
        { user: 'vol_karthik', role: 'VOLUNTEER', label: 'Karthik (Volunteer)' },
      ];

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(username, password);
      if (isAdmin && !['ADMIN', 'AGENCY_MANAGER'].includes(u.role)) {
        setError('Access denied: You do not have administrator permissions.');
        return;
      }
      if (onLoginSuccess) onLoginSuccess(u);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={'login-page ' + (isAdmin ? '' : 'user-login')}>
      <div className="login-box animate-fade-up">
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: '1.25rem' }}>
          ← Back to Portal Select
        </button>

        <div className={'login-badge ' + (isAdmin ? 'admin-badge' : 'user-badge')}>
          {isAdmin ? '🛡️ Admin Authentication' : '🆘 Citizen & Volunteer Access'}
        </div>

        <h2>{isAdmin ? 'Operations Sign In' : 'Relief Portal Sign In'}</h2>
        <p className="sub">
          {isAdmin ? 'Authorized emergency managers & administrators only' : 'Sign in to submit requests & track live dispatch'}
        </p>

        {error && <div className="error-msg">⚠️ {error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Username</label>
            <input
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={'btn ' + (isAdmin ? 'btn-primary' : 'btn-success') + ' btn-full btn-lg'}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Authenticating...</> : (isAdmin ? 'Sign In to Admin Portal' : 'Sign In to Relief Portal')}
          </button>
        </form>

        <div className="divider" />

        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Demo Accounts:
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
            {demoAccounts.map((acc) => (
              <button
                key={acc.user}
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'space-between', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => {
                  setUsername(acc.user);
                  setPassword('password123');
                }}
              >
                <span><strong>{acc.user}</strong> <span style={{ color: 'var(--text-muted)' }}>({acc.label})</span></span>
                <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>{acc.role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
