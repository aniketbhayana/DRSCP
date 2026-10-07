import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const REQUEST_TYPES = [
  { id: 'RESCUE', label: 'Emergency Rescue', icon: '🚨', desc: 'Trapped by flood or debris' },
  { id: 'MEDICAL', label: 'Medical Assistance', icon: '🏥', desc: 'Injured, chronic care or medicine' },
  { id: 'SHELTER', label: 'Shelter & Evac', icon: '🏠', desc: 'Safe shelter beds needed' },
  { id: 'FOOD', label: 'Food Ration Packs', icon: '🍱', desc: 'Emergency meals for household' },
  { id: 'WATER', label: 'Clean Drinking Water', icon: '💧', desc: 'Cans / safe drinking water' },
];

const DISTRICTS = ['Chennai', 'Chengalpattu', 'Kancheepuram', 'Tiruvallur'];

export default function UserPortal({ onSignOut }) {
  const { user, authFetch } = useAuth();

  const [reqType, setReqType] = useState('RESCUE');
  const [district, setDistrict] = useState('Chennai');
  const [household, setHousehold] = useState(2);
  const [locationText, setLocationText] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [recentResult, setRecentResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [myRequests, setMyRequests] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch citizen's existing requests
  const fetchMyRequests = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await authFetch('/api/requests/my');
      if (res.ok) {
        const data = await res.json();
        setMyRequests(data);
      }
    } catch (err) {
      console.warn('Failed to fetch history:', err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchMyRequests();
    const interval = setInterval(fetchMyRequests, 8000);
    return () => clearInterval(interval);
  }, [fetchMyRequests]);

  // Submit relief requirement
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setRecentResult(null);

    if (!locationText.trim()) {
      setErrorMsg('Please specify your current street or area location.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          request_type: reqType,
          district,
          household_size: parseInt(household) || 1,
          location_text: locationText.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      setRecentResult(data);
      setLocationText('');
      setDescription('');
      fetchMyRequests();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="user-app">
      {/* Top Header */}
      <header className="user-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="logo">🆘 DRSCP RELIEF PORTAL</div>
          <span className="badge badge-assigned" style={{ fontSize: '0.7rem' }}>CITIZEN DISPATCH</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div className="avatar avatar-sm" style={{ background: 'linear-gradient(135deg, var(--user-primary), var(--accent))' }}>
              {(user?.username || 'C')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.username}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Role: {user?.role}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="user-main">
        {/* Instant Allocation Result Banner */}
        {recentResult && (
          <div className={'result-card ' + (recentResult.auto_allocated ? 'success' : 'pending')}>
            <div className="result-title">
              <div className="result-icon">{recentResult.auto_allocated ? '⚡' : '⏳'}</div>
              <div>
                <h3 style={{ color: recentResult.auto_allocated ? 'var(--user-primary)' : 'var(--warning)', fontSize: '1.25rem' }}>
                  {recentResult.auto_allocated
                    ? 'Instant Assignment Confirmed via Math Formula!'
                    : 'Request Registered & Queued in Database'}
                </h3>
                <p style={{ fontSize: '0.875rem' }}>
                  {recentResult.auto_allocated
                    ? 'Our triage formula scored your request and immediately committed resources from the database.'
                    : 'Your request has been placed in the urgent queue. Emergency teams will fulfill it shortly.'}
                </p>
              </div>
            </div>

            <div className="result-detail">
              <div className="result-detail-item">
                <div className="lbl">Request ID</div>
                <div className="val">#{recentResult.request?.request_id}</div>
              </div>

              <div className="result-detail-item">
                <div className="lbl">Math Priority Score</div>
                <div className="val" style={{ color: 'var(--primary)' }}>
                  {Math.round(parseFloat(recentResult.request?.priority_score) || 0)} / 100
                </div>
              </div>

              <div className="result-detail-item">
                <div className="lbl">Status</div>
                <div className="val">
                  <span className={'badge badge-' + (recentResult.request?.status || 'allocated').toLowerCase()}>
                    {recentResult.request?.status || 'ALLOCATED'}
                  </span>
                </div>
              </div>

              {recentResult.allocation?.volunteer_name && (
                <div className="result-detail-item">
                  <div className="lbl">Dispatched Volunteer</div>
                  <div className="val" style={{ color: 'var(--success)' }}>
                    👤 {recentResult.allocation.volunteer_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    📞 {recentResult.allocation.volunteer_phone || 'Assigned'}
                  </div>
                </div>
              )}

              {recentResult.allocation?.shelter_name && (
                <div className="result-detail-item">
                  <div className="lbl">Assigned Shelter</div>
                  <div className="val" style={{ color: 'var(--primary)' }}>
                    🏠 {recentResult.allocation.shelter_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {recentResult.allocation.beds_allocated} Bed(s) Reserved
                  </div>
                </div>
              )}

              {recentResult.allocation?.resource_name && (
                <div className="result-detail-item">
                  <div className="lbl">Allocated Resource</div>
                  <div className="val" style={{ color: 'var(--accent)' }}>
                    📦 {recentResult.allocation.quantity}x {recentResult.allocation.resource_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    From {recentResult.allocation.shelter_name}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setRecentResult(null)}>
                Dismiss Banner
              </button>
            </div>
          </div>
        )}

        {/* Relief Request Input Form */}
        <div className="request-form-card animate-fade-up">
          <h2>Input Relief Requirements</h2>
          <p className="sub">
            Specify your emergency requirements below. The platform will automatically calculate your priority score and allocate matching shelter beds, field volunteers, or resources instantly.
          </p>

          {errorMsg && <div className="error-msg">⚠️ {errorMsg}</div>}

          <form onSubmit={handleSubmit}>
            {/* Request Type Selector */}
            <div className="form-group">
              <label>Select Requirement Type</label>
              <div className="type-grid">
                {REQUEST_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={'type-btn ' + (reqType === t.id ? 'selected' : '')}
                    onClick={() => setReqType(t.id)}
                  >
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>{t.icon}</div>
                    <div>{t.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>District</label>
                <select className="form-control" value={district} onChange={(e) => setDistrict(e.target.value)}>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Household Size (Number of Persons)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="form-control"
                  value={household}
                  onChange={(e) => setHousehold(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Your Current Location / Address</label>
              <input
                className="form-control"
                placeholder="e.g. 42 Anna Salai, Guindy, near Bus Depot"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Additional Notes / Urgent Vulnerabilities (Optional)</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="e.g. Elderly person requiring oxygen, infant, wheelchair mobility constraints..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-success btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: '0.75rem' }}
            >
              {submitting ? (
                <><span className="spinner" /> Calculating Priority &amp; Auto-Assigning...</>
              ) : (
                '🚀 Submit Requirement — Auto-Assign Instantly'
              )}
            </button>
          </form>
        </div>

        {/* Existing Citizen Requests List */}
        <div>
          <div className="section-title">
            <h2>📋 Your Registered Requests &amp; Live Allocations</h2>
            <button className="btn btn-ghost btn-sm" onClick={fetchMyRequests} disabled={loadingHistory}>
              {loadingHistory ? <span className="spinner" /> : '↻ Refresh Status'}
            </button>
          </div>

          {myRequests.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📝</div>
              <h3>No Previous Requests</h3>
              <p>When you submit a requirement above, you can monitor its real-time allocation status here.</p>
            </div>
          ) : (
            <div className="my-requests">
              {myRequests.map((r) => {
                const score = Math.round(parseFloat(r.priority_score) || 0);
                const statusStr = r.alloc_status || r.status || 'PENDING';
                return (
                  <div key={r.request_id} className="request-item animate-fade-up">
                    <div className="request-item-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-shelter">Req #{r.request_id}</span>
                        <span className="badge badge-evac">{r.request_type}</span>
                        <span className="priority-pill priority-medium">Priority Score: {score}</span>
                      </div>
                      <span className={'badge badge-' + statusStr.toLowerCase()}>{statusStr}</span>
                    </div>

                    <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
                      📍 {r.location_text} · {r.district} (Household of {r.household_size})
                    </div>

                    <div className="request-item-meta">
                      <div className="meta-item">
                        <div className="lbl">Submitted At</div>
                        <div className="val">
                          {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                        </div>
                      </div>

                      {r.shelter_name && (
                        <div className="meta-item">
                          <div className="lbl">🏠 Assigned Shelter</div>
                          <div className="val" style={{ color: 'var(--primary)' }}>
                            {r.shelter_name} ({r.beds_allocated} beds)
                          </div>
                        </div>
                      )}

                      {r.volunteer_name && (
                        <div className="meta-item">
                          <div className="lbl">👤 Dispatched Responder</div>
                          <div className="val" style={{ color: 'var(--success)' }}>
                            {r.volunteer_name} {r.volunteer_phone ? '📞 ' + r.volunteer_phone : ''}
                          </div>
                        </div>
                      )}

                      {r.resource_name && (
                        <div className="meta-item">
                          <div className="lbl">📦 Allocated Supplies</div>
                          <div className="val" style={{ color: 'var(--accent)' }}>
                            {r.resource_quantity}x {r.resource_name}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
