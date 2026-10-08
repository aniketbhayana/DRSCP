import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ portalType, onBack, onLoginSuccess }) {
  const { login } = useAuth();
  const isAdmin = portalType === 'admin';
  const isVolunteer = portalType === 'volunteer';

  const defaultUser = isAdmin ? 'admin_chennai' : (isVolunteer ? 'vol_karthik' : 'req_kavitha');
  const [username, setUsername] = useState(defaultUser);
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const demoAccounts = isAdmin
    ? [
        { user: 'admin_chennai', role: 'ADMIN', label: 'Chennai Admin' },
        { user: 'manager_tnsdma', role: 'AGENCY_MANAGER', label: 'TNSDMA Manager' },
      ]
    : isVolunteer
    ? [
        { user: 'vol_karthik', role: 'VOLUNTEER', label: 'Karthik Raja (Rescue Responder)' },
      ]
    : [
        { user: 'req_kavitha', role: 'REQUESTER', label: 'Kavitha (Citizen Requester)' },
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

  const getBadgeText = () => {
    if (isAdmin) return '🛡️ Operations & Admin Authentication';
    if (isVolunteer) return '🤝 First Responder Field Authentication';
    return '🆘 Citizen Relief Portal Sign In';
  };

  const getHeading = () => {
    if (isAdmin) return 'Operations Command Sign In';
    if (isVolunteer) return 'Volunteer Responder Sign In';
    return 'Citizen Relief Sign In';
  };

  const getButtonText = () => {
    if (isAdmin) return 'Sign In to Admin Portal';
    if (isVolunteer) return 'Sign In to Volunteer Console';
    return 'Sign In to Relief Portal';
  };

  const getButtonClass = () => {
    if (isAdmin) return 'btn-primary';
    if (isVolunteer) return 'btn-primary'; // Styled via theme
    return 'btn-success';
  };

  return (
    <div className={'login-page ' + (isAdmin ? '' : (isVolunteer ? 'volunteer-login' : 'user-login'))}>
      <div className="login-box animate-fade-up">
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: '1.25rem' }}>
          ← Back to Portal Select
        </button>

        <div className={'login-badge ' + (isAdmin ? 'admin-badge' : (isVolunteer ? 'volunteer-badge' : 'user-badge'))}>
          {getBadgeText()}
        </div>

        <h2>{getHeading()}</h2>
        <p className="sub">
          {isAdmin
            ? 'Authorized emergency managers & administrators only'
            : isVolunteer
            ? 'First responders: review assigned field allocations & complete missions'
            : 'Sign in to submit requests & track live dispatch'}
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
            className={'btn ' + getButtonClass() + ' btn-full btn-lg'}
            disabled={loading}
            style={isVolunteer ? { background: '#0284c7', borderColor: '#0284c7' } : {}}
          >
            {loading ? <><span className="spinner" /> Authenticating...</> : getButtonText()}
          </button>
        </form>

        <div className="divider" />

        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Demo Account:
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
