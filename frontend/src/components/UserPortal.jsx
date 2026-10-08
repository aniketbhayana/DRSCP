import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { safeJson } from '../utils/safeJson';

const REQUEST_TYPES = [
  { id: 'RESCUE', label: 'Emergency Rescue', desc: 'Trapped or stranded by water' },
  { id: 'MEDICAL', label: 'Medical Assistance', desc: 'Injuries, illness, or urgent medicine' },
  { id: 'SHELTER', label: 'Emergency Shelter', desc: 'Temporary shelter bed required' },
  { id: 'FOOD', label: 'Food Rations', desc: 'Packaged food and emergency meals' },
  { id: 'WATER', label: 'Drinking Water', desc: 'Safe clean drinking water cans' },
];

const DISTRICTS = ['Chennai', 'Chengalpattu', 'Kancheepuram', 'Tiruvallur'];

const SPECIAL_NEEDS = [
  { id: 'PREGNANT', label: 'Pregnant woman' },
  { id: 'INFANT', label: 'Infant / Young child' },
  { id: 'ELDERLY', label: 'Elderly person' },
  { id: 'DISABLED', label: 'Person with disability / Mobility issue' },
  { id: 'CHRONIC_ILLNESS', label: 'Chronic medical condition' },
];

export default function UserPortal({ onSignOut }) {
  const { user, authFetch } = useAuth();

  const [reqType, setReqType] = useState('RESCUE');
  const [district, setDistrict] = useState('Chennai');
  const [household, setHousehold] = useState(2);
  const [locationText, setLocationText] = useState('');
  const [description, setDescription] = useState('');
  const [selectedNeeds, setSelectedNeeds] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [recentResult, setRecentResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [myRequests, setMyRequests] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const toggleNeed = (id) => {
    setSelectedNeeds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Fetch citizen's existing requests
  const fetchMyRequests = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await authFetch('/api/requests/my');
      if (res.ok) {
        const data = await safeJson(res);
        if (Array.isArray(data)) {
          setMyRequests(data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch requests:', err.message);
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
      setErrorMsg('Please enter your street address or location.');
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
          vulnerability_flags: selectedNeeds,
        }),
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error((data && data.error) || 'Failed to submit request (' + res.status + ')');
      }

      if (data) {
        setRecentResult(data);
      }
      setLocationText('');
      setDescription('');
      setSelectedNeeds([]);
      fetchMyRequests();
    } catch (err) {
      setErrorMsg(err.message || 'Error submitting request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="user-app">
      {/* Top Header */}
      <header className="user-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="logo" style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1.15rem' }}>
            DRSCP Citizen Relief Portal
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600 }}>{user?.username}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Citizen Access</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="user-main" style={{ maxWidth: '850px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* Instant Allocation Result Banner */}
        {recentResult && (
          <div
            className="animate-fade-up"
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius)',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--success)', marginBottom: '0.2rem' }}>
                  {recentResult.auto_allocated ? 'Request Submitted & Resources Assigned' : 'Request Registered'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                  {recentResult.auto_allocated
                    ? 'Matching relief has been allocated to your request.'
                    : 'Your request is in queue and will be fulfilled shortly.'}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setRecentResult(null)}
              >
                Dismiss
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                fontSize: '0.85rem',
                background: 'rgba(0,0,0,0.2)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>REQUEST ID</span>
                <strong>#{recentResult.request?.request_id}</strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>STATUS</span>
                <span className="badge badge-completed">{recentResult.request?.status || 'ALLOCATED'}</span>
              </div>

              {recentResult.allocation?.volunteer_name && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>ASSIGNED VOLUNTEER</span>
                  <strong style={{ color: 'var(--success)' }}>{recentResult.allocation.volunteer_name}</strong>
                  {recentResult.allocation.volunteer_phone && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Phone: {recentResult.allocation.volunteer_phone}</div>
                  )}
                </div>
              )}

              {recentResult.allocation?.shelter_name && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>ASSIGNED SHELTER</span>
                  <strong style={{ color: 'var(--primary)' }}>{recentResult.allocation.shelter_name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{recentResult.allocation.beds_allocated} bed(s) reserved</div>
                </div>
              )}

              {recentResult.allocation?.resource_name && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>ALLOCATED SUPPLIES</span>
                  <strong style={{ color: 'var(--accent)' }}>
                    {recentResult.allocation.quantity}x {recentResult.allocation.resource_name}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Relief Request Input Form */}
        <div className="card animate-fade-up" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Submit Relief Request</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Fill in your details below. Emergency services will assign appropriate relief based on your needs.
          </p>

          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--danger)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Request Type Selector */}
            <div className="form-group">
              <label>What assistance do you need?</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '0.5rem',
                  marginTop: '0.4rem',
                }}
              >
                {REQUEST_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={'type-btn ' + (reqType === t.id ? 'selected' : '')}
                    onClick={() => setReqType(t.id)}
                    style={{ textAlign: 'left', padding: '0.75rem' }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {t.desc}
                    </div>
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
                <label>Household Size (Number of people)</label>
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
              <label>Street Address / Location</label>
              <input
                className="form-control"
                placeholder="e.g. 42 Anna Salai, Guindy"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                required
              />
            </div>

            {/* Special Needs Checkboxes */}
            <div className="form-group">
              <label>Special requirements in your household (optional)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                {SPECIAL_NEEDS.map((item) => {
                  const checked = selectedNeeds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: checked ? 'var(--text)' : 'var(--text-dim)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleNeed(item.id)}
                      />
                      <span>{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label>Additional Notes (optional)</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Any other helpful details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-success btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: '0.5rem', fontWeight: 600 }}
            >
              {submitting ? 'Submitting Request...' : 'Submit Request'}
            </button>
          </form>
        </div>

        {/* Previous Requests List */}
        <div>
          <div className="section-title">
            <h2 style={{ fontSize: '1.1rem' }}>Your Requests</h2>
            <button className="btn btn-ghost btn-sm" onClick={fetchMyRequests} disabled={loadingHistory}>
              {loadingHistory ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {myRequests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              No requests submitted yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myRequests.map((r) => {
                const statusStr = r.alloc_status || r.status || 'PENDING';
                return (
                  <div key={r.request_id} className="card animate-fade-up" style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge badge-pending">Req #{r.request_id}</span>
                        <strong>{r.request_type}</strong>
                      </div>
                      <span className={'badge badge-' + statusStr.toLowerCase()}>{statusStr}</span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
                      {r.location_text}, {r.district} · {r.household_size} person(s)
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.5rem',
                        fontSize: '0.8rem',
                        background: 'var(--surface-2)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Date</span>
                        <div>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</div>
                      </div>

                      {r.shelter_name && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Shelter</span>
                          <div style={{ color: 'var(--primary)', fontWeight: 500 }}>{r.shelter_name}</div>
                        </div>
                      )}

                      {r.volunteer_name && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Assigned Volunteer</span>
                          <div style={{ color: 'var(--success)', fontWeight: 500 }}>
                            {r.volunteer_name} {r.volunteer_phone ? '(' + r.volunteer_phone + ')' : ''}
                          </div>
                        </div>
                      )}

                      {r.resource_name && (
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Supplies</span>
                          <div style={{ color: 'var(--accent)', fontWeight: 500 }}>
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
