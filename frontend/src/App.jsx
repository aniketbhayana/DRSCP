
import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, Home, Box, FileText, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { mockRequests, mockStats, mockShelters } from './api/mock/data';

const Sidebar = () => {
  const { logout, user } = useAuth();
  return (
    <div className="sidebar">
      <div className="sidebar-logo">DRSCP</div>
      
      <div className="nav-links">
        <Link to="/" className="nav-link active"><LayoutDashboard size={20} /> Dashboard</Link>
        <Link to="/requests" className="nav-link"><FileText size={20} /> Requests</Link>
        <Link to="/shelters" className="nav-link"><Home size={20} /> Shelters</Link>
        <Link to="/inventory" className="nav-link"><Box size={20} /> Inventory</Link>
        <Link to="/volunteers" className="nav-link"><Users size={20} /> Volunteers</Link>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div className="user-profile" style={{ marginBottom: '1rem' }}>
          <div className="avatar">{user.username[0].toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 'bold' }}>{user.username}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.role}</div>
          </div>
        </div>
        <button className="nav-link" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }} onClick={logout}>
          <LogOut size={20} /> Logout
        </button>
      </div>
    </div>
  );
};

const Topbar = ({ title }) => (
  <div className="topbar">
    <h2>{title}</h2>
  </div>
);

const Dashboard = () => (
  <div className="animate-fade-in delay-1">
    <Topbar title="Agency Dashboard" />
    <div className="dashboard-grid">
      <div className="card">
        <div style={{ color: 'var(--text-muted)' }}>Pending Requests</div>
        <div className="stat-value">{mockStats.pending_requests}</div>
      </div>
      <div className="card">
        <div style={{ color: 'var(--text-muted)' }}>Active Volunteers</div>
        <div className="stat-value">{mockStats.active_volunteers}</div>
      </div>
      <div className="card">
        <div style={{ color: 'var(--text-muted)' }}>Critical Shelters</div>
        <div className="stat-value">{mockStats.critical_shelters}</div>
      </div>
    </div>

    <div className="card animate-fade-in delay-2">
      <h3 style={{ marginBottom: '1.5rem' }}>Urgent Requests Queue</h3>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Requester</th>
              <th>Type</th>
              <th>District</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {mockRequests.map(req => (
              <tr key={req.request_id}>
                <td>#{req.request_id}</td>
                <td>{req.requester_name}</td>
                <td>{req.request_type}</td>
                <td>{req.district}</td>
                <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{req.priority_score}</td>
                <td><span className={`badge badge-${req.status.toLowerCase()}`}>{req.status}</span></td>
                <td><button className="btn">Allocate</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const AppLayout = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
};

const Login = () => {
  const { login, user } = useAuth();
  if (user) return <Navigate to="/" />;

  return (
    <div className="login-page">
      <div className="card login-card animate-fade-in">
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>DRSCP Login</h2>
        <div className="form-group">
          <label>Username</label>
          <input type="text" className="form-control" placeholder="Enter username" />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" className="form-control" placeholder="Enter password" />
        </div>
        <button className="btn login-btn" onClick={() => login('admin', 'admin')}>Login</button>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/requests" element={<AppLayout><div><Topbar title="Requests" /></div></AppLayout>} />
          <Route path="/shelters" element={<AppLayout><div><Topbar title="Shelters" /></div></AppLayout>} />
          <Route path="/inventory" element={<AppLayout><div><Topbar title="Inventory" /></div></AppLayout>} />
          <Route path="/volunteers" element={<AppLayout><div><Topbar title="Volunteers" /></div></AppLayout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
