import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import PortalSelector from './components/PortalSelector';
import LoginModal from './components/LoginModal';
import AdminPortal from './components/AdminPortal';
import UserPortal from './components/UserPortal';
import './index.css';

const ADMIN_ROLES = ['ADMIN', 'AGENCY_MANAGER'];

function MainApp() {
  const { user, logout } = useAuth();
  // selectedPortal: null (selector) | 'admin' | 'user'
  const [selectedPortal, setSelectedPortal] = useState(null);

  // Auto-detect portal if user already has an active session in localStorage
  useEffect(() => {
    if (user && !selectedPortal) {
      if (ADMIN_ROLES.includes(user.role)) {
        setSelectedPortal('admin');
      } else {
        setSelectedPortal('user');
      }
    }
  }, [user, selectedPortal]);

  const handleSignOut = () => {
    logout();
    setSelectedPortal(null);
  };

  // State 1: Portal Selection Landing Page
  if (!selectedPortal) {
    return <PortalSelector onSelect={(type) => setSelectedPortal(type)} />;
  }

  // State 2: Login required if not authenticated
  if (!user) {
    return (
      <LoginModal
        portalType={selectedPortal}
        onBack={() => setSelectedPortal(null)}
        onLoginSuccess={() => {
          // Handled by state
        }}
      />
    );
  }

  // State 3: Admin Portal Requested
  if (selectedPortal === 'admin') {
    // Role Permission Enforcement
    if (!ADMIN_ROLES.includes(user.role)) {
      return (
        <div className="login-page">
          <div className="login-box animate-fade-up">
            <div className="login-badge admin-badge">🛡️ Access Restricted</div>
            <h2>Admin Permissions Required</h2>
            <div className="error-msg" style={{ marginTop: '1rem' }}>
              ⛔ Access Denied: Your account <strong>({user.username})</strong> has role <strong>{user.role}</strong> and cannot access the Admin Operations Center.
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Please switch to an administrator account or return to the Citizen Relief Portal.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost btn-full" onClick={() => setSelectedPortal('user')}>
                Open Citizen Portal
              </button>
              <button className="btn btn-danger btn-full" onClick={handleSignOut}>
                Switch Account
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <AdminPortal onSignOut={handleSignOut} />;
  }

  // State 4: User / Citizen Relief Portal
  return <UserPortal onSignOut={handleSignOut} />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
