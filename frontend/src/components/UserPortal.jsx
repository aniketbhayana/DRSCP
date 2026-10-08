import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { safeJson } from '../utils/safeJson';

const REQUEST_TYPES = [
  { id: 'RESCUE', label: 'Emergency Rescue', icon: '🚨', desc: 'Trapped by flood or debris' },
  { id: 'MEDICAL', label: 'Medical Assistance', icon: '🏥', desc: 'Injured, chronic care or medicine' },
  { id: 'SHELTER', label: 'Shelter & Evac', icon: '🏠', desc: 'Safe shelter beds needed' },
  { id: 'FOOD', label: 'Food Ration Packs', icon: '🍱', desc: 'Emergency meals for household' },
  { id: 'WATER', label: 'Clean Drinking Water', icon: '💧', desc: 'Cans / safe drinking water' },
];

const DISTRICTS = ['Chennai', 'Chengalpattu', 'Kancheepuram', 'Tiruvallur'];

const VULNERABILITY_OPTIONS = [
  {
    id: 'ELDERLY',
    label: 'Elderly Person (60+ yrs)',
    icon: '👵',
    weight: 20,
    desc: 'Senior citizen with reduced mobility or needing care',
  },
  {
    id: 'DISABLED',
    label: 'Wheelchair / Disabled',
    icon: '♿',
    weight: 25,
    desc: 'Wheelchair-bound, locomotor, or sensory impairment',
  },
  {
    id: 'PREGNANT',
    label: 'Pregnant Woman',
    icon: '🤰',
    weight: 30,
    desc: 'Expectant mother requiring prenatal / maternal care',
  },
  {
    id: 'INFANT',
    label: 'Infant / Toddler (< 2 yrs)',
    icon: '👶',
    weight: 20,
    desc: 'Baby requiring formula, diapers, or critical care',
  },
  {
    id: 'CHRONIC_ILLNESS',
    label: 'Chronic Illness / Oxygen',
    icon: '💊',
    weight: 15,
    desc: 'Dialysis, oxygen cylinder, or life-critical medication',
  },
];

const TYPE_SCORES = {
  RESCUE: 40,
  MEDICAL: 35,
  EVACUATION: 30,
  SHELTER: 30,
  WATER: 20,
  FOOD: 15,
};

export default function UserPortal({ onSignOut }) {
  const { user, authFetch } = useAuth();

  const [reqType, setReqType] = useState('RESCUE');
  const [district, setDistrict] = useState('Chennai');
  const [household, setHousehold] = useState(2);
  const [locationText, setLocationText] = useState('');
  const [description, setDescription] = useState('');
  const [selectedVulns, setSelectedVulns] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [recentResult, setRecentResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [myRequests, setMyRequests] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Toggle vulnerability checkbox
  const toggleVuln = (id) => {
    setSelectedVulns((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  // Real-time Priority Score Calculation (matches SQL compute_priority_score formula)
  const baseUrgencyScore = TYPE_SCORES[reqType] || 10;
  const vulnScore = selectedVulns.reduce((sum, vId) => {
    const found = VULNERABILITY_OPTIONS.find((v) => v.id === vId);
    return sum + (found ? found.weight : 0);
  }, 0);
  const householdScore = Math.min((Math.max(1, parseInt(household) || 1) - 1) * 2, 20);
  const livePriorityScore = Math.round((baseUrgencyScore + vulnScore + householdScore) * 10) / 10;

  let triageCategory = { label: 'STANDARD PRIORITY', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
  if (livePriorityScore >= 70) {
    triageCategory = { label: 'CRITICAL EMERGENCY (HIGH PRIORITY)', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
  } else if (livePriorityScore >= 40) {
    triageCategory = { label: 'ELEVATED PRIORITY (EXPEDITE)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)' };
  }

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
          vulnerabilities: selectedVulns,
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
      setSelectedVulns([]);
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
                    ? 'Instant Assignment Confirmed via Priority Formula!'
                    : 'Request Registered & Scored in Database'}
                </h3>
                <p style={{ fontSize: '0.875rem' }}>
                  {recentResult.auto_allocated
                    ? 'Our triage formula scored your request and immediately committed matching shelter beds, volunteers, or resources.'
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
                <div className="lbl">Database Priority Score</div>
                <div className="val" style={{ color: 'var(--primary)', fontWeight: 800 }}>
                  {parseFloat(recentResult.request?.priority_score || 0).toFixed(1)} pts
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
                  <div className="lbl">Dispatched Responder</div>
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
            Specify your emergency requirements and any vulnerable members (elderly, wheelchair, pregnant, infants) to trigger elevated priority scoring and instant dispatch.
          </p>

          {errorMsg && <div className="error-msg">⚠️ {errorMsg}</div>}

          <form onSubmit={handleSubmit}>
            {/* Request Type Selector */}
            <div className="form-group">
              <label>Select Requirement Type (Base Urgency Weight)</label>
              <div className="type-grid">
                {REQUEST_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={'type-btn ' + (reqType === t.id ? 'selected' : '')}
                    onClick={() => setReqType(t.id)}
                  >
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>{t.icon}</div>
                    <div style={{ fontWeight: 600 }}>{t.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      +{TYPE_SCORES[t.id]} pts base
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
                <label>Household Size (Persons)</label>
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

            {/* VULNERABILITY CHECKBOXES (Requirement 2) */}
            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🚨 Household Vulnerabilities (Select all that apply for Higher Priority)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                  +{vulnScore} pts added from vulnerabilities
                </span>
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.75rem',
                  marginTop: '0.5rem',
                }}
              >
                {VULNERABILITY_OPTIONS.map((opt) => {
                  const isChecked = selectedVulns.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => toggleVuln(opt.id)}
                      style={{
                        background: isChecked ? 'rgba(59, 130, 246, 0.12)' : 'var(--surface-2)',
                        border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem 0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.65rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent div onClick
                        style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: isChecked ? '#fff' : 'var(--text)' }}>
                            {opt.icon} {opt.label}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: isChecked ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                              color: isChecked ? '#fff' : 'var(--text-muted)',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                            }}
                          >
                            +{opt.weight} pts
                          </span>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {opt.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LIVE PRIORITY SCORE CALCULATOR / PREVIEW WIDGET */}
            <div
              style={{
                background: triageCategory.bg,
                border: `1px solid ${triageCategory.border}`,
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                marginTop: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>📊</span>
                  <strong style={{ fontSize: '0.95rem', color: triageCategory.color }}>
                    Real-Time Priority Score Calculator
                  </strong>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: triageCategory.color,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    border: `1px solid ${triageCategory.color}`,
                  }}
                >
                  {triageCategory.label}
                </span>
              </div>

              {/* Formula chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.825rem' }}>
                <span style={{ background: 'var(--surface-2)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  Type Urgency: <strong>+{baseUrgencyScore}</strong> ({reqType})
                </span>
                <span>+</span>
                <span style={{ background: 'var(--surface-2)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  Vulnerability Flags: <strong style={{ color: vulnScore > 0 ? '#34d399' : 'inherit' }}>+{vulnScore}</strong> ({selectedVulns.length} active)
                </span>
                <span>+</span>
                <span style={{ background: 'var(--surface-2)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  Household Scale: <strong>+{householdScore}</strong> ({household} pax)
                </span>
                <span>=</span>
                <span
                  style={{
                    background: 'var(--surface-3)',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    color: triageCategory.color,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {livePriorityScore.toFixed(1)} pts
                </span>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
                💡 Formula: <code>compute_priority_score = SUM(vulnerabilities) + wait_bonus + urgency_constant + household_factor</code>. Higher scores are prioritized at the top of the dispatch queue.
              </div>
            </div>

            <div className="form-group">
              <label>Additional Situation Details (Optional)</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="e.g. Water reached 3 feet, stranded on terrace, urgent boat needed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-success btn-full btn-lg"
              disabled={submitting}
              style={{ marginTop: '0.75rem', fontWeight: 700 }}
            >
              {submitting ? (
                <><span className="spinner" /> Computing Priority &amp; Auto-Assigning...</>
              ) : (
                `🚀 Submit Request (Priority Score: ${livePriorityScore.toFixed(1)} pts)`
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
                const score = parseFloat(r.priority_score || 0).toFixed(1);
                const statusStr = r.alloc_status || r.status || 'PENDING';
                return (
                  <div key={r.request_id} className="request-item animate-fade-up">
                    <div className="request-item-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-shelter">Req #{r.request_id}</span>
                        <span className="badge badge-evac">{r.request_type}</span>
                        <span className="priority-pill priority-medium" style={{ fontWeight: 700 }}>
                          🔥 Priority Score: {score} pts
                        </span>
                      </div>
                      <span className={'badge badge-' + statusStr.toLowerCase()}>{statusStr}</span>
                    </div>

                    <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                      📍 {r.location_text} · {r.district} (Household of {r.household_size})
                    </div>

                    {/* Show Tagged Vulnerabilities */}
                    {r.vulnerabilities && (
                      <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vulnerabilities:</span>
                        {r.vulnerabilities.split(',').map((v) => (
                          <span
                            key={v.trim()}
                            style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '4px',
                              padding: '0.1rem 0.4rem',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                            }}
                          >
                            {v.trim()}
                          </span>
                        ))}
                      </div>
                    )}

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
