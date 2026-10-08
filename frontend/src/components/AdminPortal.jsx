import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { safeJson } from '../utils/safeJson';

const BADGE_MAP = {
  RESCUE: 'badge-rescue',
  MEDICAL: 'badge-medical',
  FOOD: 'badge-food',
  WATER: 'badge-water',
  EVACUATION: 'badge-evac',
};

export default function AdminPortal({ onSignOut }) {
  const { user, authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('allocations');
  const [loading, setLoading] = useState(false);

  const [allocations, setAllocations] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [urgentRequests, setUrgentRequests] = useState([]);

  // Manual allocation modal state
  const [selectedReq, setSelectedReq] = useState(null);
  const [allocType, setAllocType] = useState('bed');
  const [selectedShelterId, setSelectedShelterId] = useState('');
  const [selectedVolId, setSelectedVolId] = useState('');
  const [bedCount, setBedCount] = useState(1);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allocRes, invRes, shelterRes, volRes, reqRes] = await Promise.all([
        authFetch('/api/allocations'),
        authFetch('/api/inventory'),
        authFetch('/api/shelters'),
        authFetch('/api/volunteers'),
        authFetch('/api/requests/urgent'),
      ]);

      if (allocRes.ok) {
        const d = await safeJson(allocRes);
        if (Array.isArray(d)) setAllocations(d);
      }
      if (invRes.ok) {
        const d = await safeJson(invRes);
        if (Array.isArray(d)) setInventory(d);
      }
      if (shelterRes.ok) {
        const d = await safeJson(shelterRes);
        if (Array.isArray(d)) setShelters(d);
      }
      if (volRes.ok) {
        const d = await safeJson(volRes);
        if (Array.isArray(d)) setVolunteers(d);
      }
      if (reqRes.ok) {
        const d = await safeJson(reqRes);
        if (Array.isArray(d)) setUrgentRequests(d);
      }
    } catch (err) {
      console.warn('Admin load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 7000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle Complete Allocation
  const handleCompleteAlloc = async (allocId) => {
    if (!window.confirm('Mark allocation #' + allocId + ' as completed?')) return;
    try {
      await authFetch('/api/allocations/' + allocId + '/complete', { method: 'POST' });
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Handle Cancel Allocation
  const handleCancelAlloc = async (allocId) => {
    if (!window.confirm('Cancel allocation #' + allocId + '?')) return;
    try {
      await authFetch('/api/allocations/' + allocId + '/cancel', { method: 'POST' });
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Open manual allocate modal
  const openManualModal = (req) => {
    setSelectedReq(req);
    setAllocType('bed');
    setBedCount(req.household_size || 1);
    if (shelters.length) setSelectedShelterId(shelters[0].shelter_id);
    const availVol = volunteers.find((v) => v.availability_status === 'AVAILABLE');
    if (availVol) setSelectedVolId(availVol.volunteer_id);
  };

  // Submit manual allocation
  const submitManualAlloc = async () => {
    if (!selectedReq) return;
    setModalSubmitting(true);
    try {
      if (allocType === 'bed') {
        await authFetch('/api/allocations/bed', {
          method: 'POST',
          body: JSON.stringify({
            request_id: selectedReq.request_id,
            shelter_id: parseInt(selectedShelterId),
            beds: parseInt(bedCount),
          }),
        });
      } else {
        await authFetch('/api/allocations/volunteer', {
          method: 'POST',
          body: JSON.stringify({
            request_id: selectedReq.request_id,
            volunteer_id: parseInt(selectedVolId),
          }),
        });
      }
      setSelectedReq(null);
      loadData();
    } catch (err) {
      alert('Manual allocation failed: ' + err.message);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Aggregate stats
  const totalCapacity = shelters.reduce((acc, s) => acc + (parseInt(s.total_capacity) || 0), 0);
  const totalOccupancy = shelters.reduce((acc, s) => acc + (parseInt(s.current_occupancy) || 0), 0);
  const freeBeds = totalCapacity - totalOccupancy;
  const lowStockCount = inventory.filter((i) => i.is_low_stock).length;
  const availableVols = volunteers.filter((v) => v.availability_status === 'AVAILABLE').length;
  const activeAllocCount = allocations.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="admin-app">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="mark">DRSCP ADMIN</div>
          <div className="sub">Disaster Control Center</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={'nav-item ' + (activeTab === 'allocations' ? 'active' : '')}
            onClick={() => setActiveTab('allocations')}
          >
            <span className="icon">🔗</span> Who's Allocated Where
          </button>
          <button
            className={'nav-item ' + (activeTab === 'inventory' ? 'active' : '')}
            onClick={() => setActiveTab('inventory')}
          >
            <span className="icon">📦</span> Stock Inventory
          </button>
          <button
            className={'nav-item ' + (activeTab === 'shelters' ? 'active' : '')}
            onClick={() => setActiveTab('shelters')}
          >
            <span className="icon">🏠</span> Shelters & Beds
          </button>
          <button
            className={'nav-item ' + (activeTab === 'volunteers' ? 'active' : '')}
            onClick={() => setActiveTab('volunteers')}
          >
            <span className="icon">👤</span> Field Volunteers
          </button>
          <button
            className={'nav-item ' + (activeTab === 'urgent' ? 'active' : '')}
            onClick={() => setActiveTab('urgent')}
          >
            <span className="icon">🚨</span> Priority Queue ({urgentRequests.length})
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{(user?.username || 'A')[0].toUpperCase()}</div>
            <div className="user-info">
              <div className="name">{user?.username}</div>
              <div className="role">{user?.role}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: '0.75rem' }} onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        {/* Header Bar */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1>Emergency Coordination Dashboard</h1>
              <p>Real-time surveillance: allocations, supply inventory & responder deployment</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="live-dot">LIVE SYNC</span>
              <button className="btn btn-ghost btn-sm" onClick={loadData} disabled={loading}>
                {loading ? <span className="spinner" /> : '↻ Refresh Data'}
              </button>
            </div>
          </div>
        </div>

        <div className="page-body">
          {/* Top Quick Metrics */}
          <div className="stats-grid">
            <div className="stat-card blue">
              <div className="stat-label">Active Allocations</div>
              <div className="stat-value">{activeAllocCount}</div>
              <div className="stat-sub">Across shelters & field responders</div>
            </div>
            <div className="stat-card green">
              <div className="stat-label">Free Shelter Beds</div>
              <div className="stat-value">{freeBeds}</div>
              <div className="stat-sub">{totalOccupancy} of {totalCapacity} occupied</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-label">Stock Alerts</div>
              <div className="stat-value">{lowStockCount}</div>
              <div className="stat-sub">Items below safety reorder threshold</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">Volunteers Ready</div>
              <div className="stat-value">{availableVols}</div>
              <div className="stat-sub">{volunteers.length} total on duty</div>
            </div>
          </div>

          {/* TAB 1: WHO'S ALLOCATED WHERE */}
          {activeTab === 'allocations' && (
            <div>
              <div className="section-title">
                <h2>🔗 Active Resource Allocations ("Who is Allocated Where")</h2>
                <p>Live matching of citizens to shelter spaces, volunteers, and supplies</p>
              </div>

              {allocations.length === 0 ? (
                <div className="empty-state">
                  <div className="emoji">📋</div>
                  <h3>No Allocations Recorded Yet</h3>
                  <p>When citizens submit requests, automated assignment links them here.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Alloc ID</th>
                        <th>Request ID & Type</th>
                        <th>Citizen / Requester</th>
                        <th>Allocated Shelter</th>
                        <th>Assigned Volunteer</th>
                        <th>Beds Reserved</th>
                        <th>Status</th>
                        <th>Allocated At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a) => (
                        <tr key={a.allocation_id} className={a.status === 'ACTIVE' ? 'alloc-row' : ''}>
                          <td><strong>#{a.allocation_id}</strong></td>
                          <td>
                            <span className="badge badge-pending">Req #{a.request_id}</span>
                            <div style={{ marginTop: '0.2rem' }}>
                              <span className={'badge ' + (BADGE_MAP[a.request_type] || 'badge-pending')}>
                                {a.request_type}
                              </span>
                            </div>
                          </td>
                          <td>
                            <strong>{a.requester_name || 'Anonymous Citizen'}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              📞 {a.requester_phone || 'N/A'} · {a.request_district}
                            </div>
                          </td>
                          <td>
                            {a.shelter_name ? (
                              <>
                                <strong style={{ color: 'var(--primary)' }}>🏠 {a.shelter_name}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.shelter_district}</div>
                              </>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            {a.volunteer_name ? (
                              <>
                                <strong style={{ color: 'var(--success)' }}>👤 {a.volunteer_name}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Skill: {a.volunteer_skill || 'General'}
                                </div>
                              </>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            {a.beds_allocated > 0 ? (
                              <strong style={{ color: 'var(--accent)' }}>{a.beds_allocated} beds</strong>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <span className={'badge badge-' + a.status.toLowerCase()}>{a.status}</span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {a.allocated_at ? new Date(a.allocated_at).toLocaleTimeString() : '—'}
                          </td>
                          <td>
                            {a.status === 'ACTIVE' && (
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  className="btn btn-success btn-sm"
                                  title="Mark as completed"
                                  onClick={() => handleCompleteAlloc(a.allocation_id)}
                                >
                                  ✓ Done
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  title="Cancel allocation"
                                  onClick={() => handleCancelAlloc(a.allocation_id)}
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STOCK INVENTORY */}
          {activeTab === 'inventory' && (
            <div>
              <div className="section-title">
                <h2>📦 Relief Resource Stock & Inventory Control</h2>
                <p>Tracking essential provisions, water supplies, medical kits, and low-stock alerts</p>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Inventory ID</th>
                      <th>Resource Item</th>
                      <th>Category</th>
                      <th>Shelter Depot</th>
                      <th>District</th>
                      <th>Available Quantity</th>
                      <th>Safety Threshold</th>
                      <th>Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map((item) => (
                      <tr key={item.inventory_id}>
                        <td style={{ color: 'var(--text-muted)' }}>#{item.inventory_id}</td>
                        <td><strong>{item.resource_name}</strong></td>
                        <td>
                          <span className={'badge ' + (BADGE_MAP[item.category] || 'badge-pending')}>
                            {item.category}
                          </span>
                        </td>
                        <td>{item.shelter_name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.district}</td>
                        <td>
                          <strong style={{ fontSize: '1rem', color: item.is_low_stock ? 'var(--danger)' : 'var(--text)' }}>
                            {item.quantity_available} {item.unit}
                          </strong>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {item.reorder_threshold} {item.unit}
                        </td>
                        <td>
                          {item.is_low_stock ? (
                            <span className="badge badge-low">⚠️ LOW STOCK</span>
                          ) : (
                            <span className="badge badge-ok">✓ SUFFICIENT</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SHELTERS */}
          {activeTab === 'shelters' && (
            <div>
              <div className="section-title">
                <h2>🏠 Emergency Shelters & Bed Availability</h2>
                <p>Live bed capacity and occupancy status across all designated relief shelters</p>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Shelter Name</th>
                      <th>Agency</th>
                      <th>District</th>
                      <th>Operational Status</th>
                      <th>Occupancy Progress</th>
                      <th>Available Beds</th>
                      <th>Total Capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shelters.map((s) => {
                      const avail = (parseInt(s.total_capacity) || 0) - (parseInt(s.current_occupancy) || 0);
                      const pct = Math.round(((parseInt(s.current_occupancy) || 0) / (parseInt(s.total_capacity) || 1)) * 100);
                      return (
                        <tr key={s.shelter_id}>
                          <td><strong>{s.name || s.shelter_name}</strong></td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{s.agency_name}</td>
                          <td>{s.district}</td>
                          <td>
                            <span className={'badge badge-' + s.status.toLowerCase()}>{s.status}</span>
                          </td>
                          <td style={{ minWidth: '160px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div style={{ flex: 1, height: '8px', background: 'var(--surface-3)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: pct + '%',
                                    height: '100%',
                                    background: avail < 15 ? 'var(--danger)' : 'var(--primary)',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '0.8rem', minWidth: '35px' }}>{pct}%</span>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: avail < 15 ? 'var(--danger)' : 'var(--success)', fontSize: '1.05rem' }}>
                              {avail} beds
                            </strong>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{s.total_capacity} beds</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: VOLUNTEERS */}
          {activeTab === 'volunteers' && (
            <div>
              <div className="section-title">
                <h2>👤 Field Volunteer Responders</h2>
                <p>Deployment roster of active and available emergency relief volunteers</p>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Volunteer Name</th>
                      <th>Primary Skill</th>
                      <th>Affiliated Agency</th>
                      <th>Contact Phone</th>
                      <th>Availability Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volunteers.map((v) => (
                      <tr key={v.volunteer_id}>
                        <td><strong>{v.full_name}</strong></td>
                        <td>
                          <span className="badge badge-shelter">{v.skill}</span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{v.agency_name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{v.phone}</td>
                        <td>
                          <span className={'badge badge-' + v.availability_status.toLowerCase()}>
                            {v.availability_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: URGENT REQUESTS */}
          {activeTab === 'urgent' && (
            <div>
              <div className="section-title">
                <h2>🚨 Ranked Relief Queue (Trigger Math Priority Formula)</h2>
                <p>Requests automatically scored by vulnerability, type bonus & wait-time formula</p>
              </div>

              {/* Priority Score Review & Simulation Tool */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>🧮</span>
                  <h3 style={{ fontSize: '1.05rem', color: 'var(--text)' }}>
                    Priority Score Review &amp; Formula Verification
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  The database function <code>compute_priority_score()</code> evaluates every incoming request against table-driven vulnerability weights:
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.65rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ background: 'var(--surface-2)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PREGNANT WOMAN</div>
                    <strong style={{ color: '#f43f5e', fontSize: '1.1rem' }}>+30.00 pts</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Maternal monitoring</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>WHEELCHAIR / DISABLED</div>
                    <strong style={{ color: '#a855f7', fontSize: '1.1rem' }}>+25.00 pts</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Locomotor impairment</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ELDERLY (60+)</div>
                    <strong style={{ color: '#38bdf8', fontSize: '1.1rem' }}>+20.00 pts</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Reduced mobility</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>INFANT / TODDLER</div>
                    <strong style={{ color: '#34d399', fontSize: '1.1rem' }}>+20.00 pts</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Under 2 years / milk</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CHRONIC ILLNESS</div>
                    <strong style={{ color: '#fbbf24', fontSize: '1.1rem' }}>+15.00 pts</strong>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Dialysis / oxygen</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', background: 'var(--surface-3)', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
                  📌 <strong>Mathematical Model:</strong> <code>Score = SUM(vuln_weights) + urgency_constant(Rescue=40, Med=35, Evac=30, Water=20, Food=15) + (household-1)*2 [cap 20] + wait_bonus [cap 50]</code>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Priority Formula Score</th>
                      <th>Req ID</th>
                      <th>Citizen</th>
                      <th>Type</th>
                      <th>Household</th>
                      <th>Vulnerabilities Tagged</th>
                      <th>District & Location</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgentRequests.map((r) => {
                      const score = Math.round(parseFloat(r.priority_score) || 0);
                      const pClass = score >= 70 ? 'priority-high' : score >= 40 ? 'priority-medium' : 'priority-low';
                      return (
                        <tr key={r.request_id}>
                          <td>
                            <span className={'priority-pill ' + pClass}>{score} / 100</span>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>#{r.request_id}</td>
                          <td>
                            <strong>{r.requester_name || 'Citizen'}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.requester_phone}</div>
                          </td>
                          <td>
                            <span className={'badge ' + (BADGE_MAP[r.request_type] || 'badge-pending')}>
                              {r.request_type}
                            </span>
                          </td>
                          <td>{r.household_size} persons</td>
                          <td>
                            {r.vulnerabilities ? (
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                {r.vulnerabilities.split(',').map((v) => (
                                  <span
                                    key={v.trim()}
                                    style={{
                                      background: 'rgba(245, 158, 11, 0.15)',
                                      color: '#fbbf24',
                                      border: '1px solid rgba(245, 158, 11, 0.3)',
                                      borderRadius: '4px',
                                      padding: '0.1rem 0.35rem',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {v.trim()}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>None</span>
                            )}
                          </td>
                          <td>
                            <div>{r.district}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.location_text}</div>
                          </td>
                          <td>
                            <span className={'badge badge-' + (r.status || 'pending').toLowerCase()}>{r.status}</span>
                          </td>
                          <td>
                            {r.status === 'PENDING' && (
                              <button className="btn btn-primary btn-sm" onClick={() => openManualModal(r)}>
                                Manual Assign
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Manual Allocation Modal */}
      {selectedReq && (
        <div className="modal-overlay" onClick={() => setSelectedReq(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Manual Resource Allocation</h3>
            <p className="modal-sub">
              Assigning Req #{selectedReq.request_id} · {selectedReq.requester_name} ({selectedReq.request_type})
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className={'btn btn-sm ' + (allocType === 'bed' ? 'btn-primary' : 'btn-ghost')}
                onClick={() => setAllocType('bed')}
              >
                🏠 Shelter Beds
              </button>
              <button
                type="button"
                className={'btn btn-sm ' + (allocType === 'vol' ? 'btn-primary' : 'btn-ghost')}
                onClick={() => setAllocType('vol')}
              >
                👤 Volunteer Dispatch
              </button>
            </div>

            {allocType === 'bed' ? (
              <>
                <div className="form-group">
                  <label>Select Open Shelter</label>
                  <select
                    className="form-control"
                    value={selectedShelterId}
                    onChange={(e) => setSelectedShelterId(e.target.value)}
                  >
                    {shelters
                      .filter((s) => s.status === 'OPEN')
                      .map((s) => (
                        <option key={s.shelter_id} value={s.shelter_id}>
                          {s.name || s.shelter_name} ({s.district}) — {s.total_capacity - s.current_occupancy} beds free
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Number of Beds</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={bedCount}
                    onChange={(e) => setBedCount(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label>Select Available Volunteer</label>
                <select
                  className="form-control"
                  value={selectedVolId}
                  onChange={(e) => setSelectedVolId(e.target.value)}
                >
                  {volunteers
                    .filter((v) => v.availability_status === 'AVAILABLE')
                    .map((v) => (
                      <option key={v.volunteer_id} value={v.volunteer_id}>
                        {v.full_name} ({v.skill}) — {v.agency_name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSelectedReq(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitManualAlloc} disabled={modalSubmitting}>
                {modalSubmitting ? <><span className="spinner" /> Allocating...</> : 'Confirm Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
