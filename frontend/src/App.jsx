import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, Home, Box, FileText, LogOut, PlusCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { mockRequests, mockStats, mockShelters } from './api/mock/data';

const Sidebar = () => {
  const { logout, user } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { to: '/requests', label: 'Requests', icon: <FileText size={20} /> },
    { to: '/shelters', label: 'Shelters', icon: <Home size={20} /> },
    { to: '/inventory', label: 'Inventory', icon: <Box size={20} /> },
    { to: '/volunteers', label: 'Volunteers', icon: <Users size={20} /> },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">DRSCP</div>
      
      <div className="nav-links">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
          >
            {link.icon} {link.label}
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div className="user-profile" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="avatar" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary, #2563eb)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {user?.username ? user.username[0].toUpperCase() : 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>{user?.username || 'Responder'}</div>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>{user?.role || 'COORDINATOR'}</div>
          </div>
        </div>
        <button
          className="nav-link"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={logout}
        >
          <LogOut size={20} /> Logout
        </button>
      </div>
    </div>
  );
};

const Topbar = ({ title, actionButton }) => (
  <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
    <h2 style={{ margin: 0 }}>{title}</h2>
    {actionButton}
  </div>
);

// =============================================================================
// DASHBOARD
// =============================================================================
const Dashboard = ({ requests, shelters, volunteers, onOpenAllocate }) => {
  const pendingCount = requests.filter(r => r.status === 'PENDING').length;
  const criticalSheltersCount = shelters.filter(s => s.status === 'FULL' || (s.current_occupancy / s.total_capacity) > 0.85).length;
  const availableVolunteersCount = volunteers.filter(v => v.availability_status === 'AVAILABLE').length;

  return (
    <div className="animate-fade-in">
      <Topbar title="Triage & Operations Dashboard" />
      
      <div className="dashboard-grid">
        <div className="card">
          <div style={{ color: 'var(--text-muted)' }}>Pending Distress Requests</div>
          <div className="stat-value" style={{ color: '#ef4444' }}>{pendingCount}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)' }}>Available Responders</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{availableVolunteersCount}</div>
        </div>
        <div className="card">
          <div style={{ color: 'var(--text-muted)' }}>High-Capacity Shelters</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{criticalSheltersCount}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Ranked Triage Dispatch Queue (Highest Urgency First)</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Requester</th>
                <th>Category</th>
                <th>District</th>
                <th>Priority Score</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 10).map((req) => (
                <tr key={req.request_id}>
                  <td>#{req.request_id}</td>
                  <td><strong>{req.requester_name || `Requester #${req.requester_id}`}</strong></td>
                  <td>
                    <span className="badge" style={{ background: req.request_type === 'RESCUE' || req.request_type === 'MEDICAL' ? '#fee2e2' : '#e0e7ff', color: req.request_type === 'RESCUE' || req.request_type === 'MEDICAL' ? '#b91c1c' : '#3730a3' }}>
                      {req.request_type}
                    </span>
                  </td>
                  <td>{req.district}</td>
                  <td style={{ color: parseFloat(req.priority_score) >= 60 ? '#dc2626' : '#2563eb', fontWeight: 'bold' }}>
                    {parseFloat(req.priority_score).toFixed(1)}
                  </td>
                  <td>
                    <span className={`badge badge-${(req.status || '').toLowerCase()}`}>
                      {req.status}
                    </span>
                  </td>
                  <td>
                    {req.status === 'PENDING' ? (
                      <button className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => onOpenAllocate(req)}>
                        Allocate
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle size={14} /> Assigned
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SHELTERS VIEW
// =============================================================================
const SheltersView = ({ shelters }) => (
  <div className="animate-fade-in">
    <Topbar title="Emergency Shelter Network" />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
      {shelters.map((s) => {
        const pct = Math.min(100, Math.round((s.current_occupancy / s.total_capacity) * 100));
        return (
          <div key={s.shelter_id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h4 style={{ margin: 0 }}>{s.name || s.shelter_name}</h4>
              <span className={`badge badge-${s.status.toLowerCase()}`}>{s.status}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666' }}>{s.address}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>District: {s.district}</div>
            
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                <span>Occupancy: {s.current_occupancy} / {s.total_capacity} beds</span>
                <span>{pct}%</span>
              </div>
              <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#ef4444' : pct > 75 ? '#f59e0b' : '#10b981' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// =============================================================================
// VOLUNTEERS VIEW
// =============================================================================
const VolunteersView = ({ volunteers }) => (
  <div className="animate-fade-in">
    <Topbar title="Field Relief Volunteers" />
    <div className="card">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Full Name</th>
              <th>Skill</th>
              <th>Phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {volunteers.map((v) => (
              <tr key={v.volunteer_id}>
                <td>#{v.volunteer_id}</td>
                <td><strong>{v.full_name}</strong></td>
                <td>
                  <span className="badge" style={{ background: '#f3f4f6', color: '#1f2937' }}>{v.skill}</span>
                </td>
                <td>{v.phone}</td>
                <td>
                  <span className="badge" style={{ background: v.availability_status === 'AVAILABLE' ? '#d1fae5' : '#fee2e2', color: v.availability_status === 'AVAILABLE' ? '#065f46' : '#991b1b' }}>
                    {v.availability_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// =============================================================================
// INVENTORY VIEW
// =============================================================================
const InventoryView = ({ inventory }) => (
  <div className="animate-fade-in">
    <Topbar title="Emergency Supplies & Stockpiles" />
    <div className="card">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Shelter</th>
              <th>Resource</th>
              <th>Category</th>
              <th>Available</th>
              <th>Unit</th>
              <th>Alert Status</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((inv) => {
              const isLow = inv.quantity_available <= inv.reorder_threshold;
              return (
                <tr key={inv.inventory_id}>
                  <td>#{inv.inventory_id}</td>
                  <td>{inv.shelter_name || `Shelter #${inv.shelter_id}`}</td>
                  <td><strong>{inv.resource_name || `Resource #${inv.resource_type_id}`}</strong></td>
                  <td>{inv.category || 'GENERAL'}</td>
                  <td style={{ fontWeight: 'bold' }}>{inv.quantity_available}</td>
                  <td>{inv.unit || 'units'}</td>
                  <td>
                    {isLow ? (
                      <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={12} /> LOW STOCK
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>NORMAL</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// =============================================================================
// ALLOCATE MODAL
// =============================================================================
const AllocateModal = ({ request, shelters, volunteers, onClose, onAllocated }) => {
  const [allocType, setAllocType] = useState('bed');
  const [shelterId, setShelterId] = useState(shelters[0]?.shelter_id || '');
  const [volunteerId, setVolunteerId] = useState(volunteers[0]?.volunteer_id || '');
  const [beds, setBeds] = useState(request?.household_size || 1);
  const [submitting, setSubmitting] = useState(false);
  const { token } = useAuth();

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      if (allocType === 'bed') {
        await fetch('/api/allocations/bed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ request_id: request.request_id, shelter_id: parseInt(shelterId), beds: parseInt(beds) })
        });
      } else {
        await fetch('/api/allocations/volunteer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ request_id: request.request_id, volunteer_id: parseInt(volunteerId) })
        });
      }
      onAllocated(request.request_id);
      onClose();
    } catch (err) {
      console.error('Allocation error:', err);
      onAllocated(request.request_id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: 440, maxWidth: '90%' }}>
        <h3>Allocate Relief for #{request.request_id}</h3>
        <p style={{ fontSize: '0.85rem', color: '#666', marginTop: 4 }}>
          {request.requester_name} &bull; {request.request_type} &bull; {request.district} (Household: {request.household_size})
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
          <button className={`btn ${allocType === 'bed' ? '' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setAllocType('bed')}>
            Shelter Bed
          </button>
          <button className={`btn ${allocType === 'volunteer' ? '' : 'btn-outline'}`} style={{ flex: 1 }} onClick={() => setAllocType('volunteer')}>
            Volunteer Dispatch
          </button>
        </div>

        {allocType === 'bed' ? (
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Shelter</label>
            <select className="form-control" value={shelterId} onChange={(e) => setShelterId(e.target.value)} style={{ marginTop: '0.25rem', width: '100%', padding: '0.5rem' }}>
              {shelters.filter(s => s.status !== 'CLOSED').map(s => (
                <option key={s.shelter_id} value={s.shelter_id}>
                  {s.name || s.shelter_name} ({s.total_capacity - s.current_occupancy} beds left)
                </option>
              ))}
            </select>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginTop: '0.75rem' }}>Beds to Reserve</label>
            <input type="number" min="1" className="form-control" value={beds} onChange={(e) => setBeds(e.target.value)} style={{ marginTop: '0.25rem', width: '100%', padding: '0.5rem' }} />
          </div>
        ) : (
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Volunteer</label>
            <select className="form-control" value={volunteerId} onChange={(e) => setVolunteerId(e.target.value)} style={{ marginTop: '0.25rem', width: '100%', padding: '0.5rem' }}>
              {volunteers.map(v => (
                <option key={v.volunteer_id} value={v.volunteer_id}>
                  {v.full_name} ({v.skill} &bull; {v.availability_status})
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button className="btn" style={{ background: '#e5e7eb', color: '#333' }} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Allocating...' : 'Confirm Allocation'}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// LOGIN VIEW
// =============================================================================
const Login = () => {
  const { login, user } = useAuth();
  const [username, setUsername] = useState('admin_chennai');
  const [password, setPassword] = useState('password123');

  if (user) return <Navigate to="/" />;

  return (
    <div className="login-page">
      <div className="card login-card animate-fade-in">
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>DRSCP System Access</h2>
        <p style={{ textAlign: 'center', color: '#666', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Disaster Resource & Shelter Coordination Platform
        </p>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Username</label>
          <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Password</label>
          <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <button className="btn login-btn" style={{ width: '100%', padding: '0.75rem' }} onClick={() => login(username, password)}>
          Sign In
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// ROOT APP
// =============================================================================
const AppContent = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [activeModalRequest, setActiveModalRequest] = useState(null);

  // Fetch live database records from backend API
  const loadData = async () => {
    try {
      const [reqRes, shelterRes, volRes, invRes] = await Promise.all([
        fetch('/api/requests/urgent'),
        fetch('/api/shelters'),
        fetch('/api/volunteers'),
        fetch('/api/inventory'),
      ]);

      if (reqRes.ok) {
        const data = await reqRes.json();
        if (data && data.length) setRequests(data);
      }
      if (shelterRes.ok) {
        const data = await shelterRes.json();
        if (data && data.length) setShelters(data);
      }
      if (volRes.ok) {
        const data = await volRes.json();
        if (data && data.length) setVolunteers(data);
      }
      if (invRes.ok) {
        const data = await invRes.json();
        if (data && data.length) setInventory(data);
      }
    } catch (err) {
      console.warn('API error, using initial dataset:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Polling every 5s for real-time dashboard updates
    return () => clearInterval(interval);
  }, []);

  const handleAllocated = (requestId) => {
    setRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, status: 'ALLOCATED' } : r));
    loadData();
  };

  if (!user) return <Login />;

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard requests={requests} shelters={shelters} volunteers={volunteers} onOpenAllocate={setActiveModalRequest} />} />
          <Route path="/requests" element={<Dashboard requests={requests} shelters={shelters} volunteers={volunteers} onOpenAllocate={setActiveModalRequest} />} />
          <Route path="/shelters" element={<SheltersView shelters={shelters} />} />
          <Route path="/inventory" element={<InventoryView inventory={inventory} />} />
          <Route path="/volunteers" element={<VolunteersView volunteers={volunteers} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>

      {activeModalRequest && (
        <AllocateModal
          request={activeModalRequest}
          shelters={shelters}
          volunteers={volunteers}
          onClose={() => setActiveModalRequest(null)}
          onAllocated={handleAllocated}
        />
      )}
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
