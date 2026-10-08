import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const TYPE_CONFIG = {
  RESCUE: { label: 'EMERGENCY RESCUE', badge: 'badge-rescue', icon: '🚨', urgency: 'CRITICAL' },
  MEDICAL: { label: 'MEDICAL DISPATCH', badge: 'badge-medical', icon: '🏥', urgency: 'HIGH' },
  EVACUATION: { label: 'EVACUATION / SHELTER', badge: 'badge-evac', icon: '🏠', urgency: 'HIGH' },
  SHELTER: { label: 'SHELTER ASSIGNMENT', badge: 'badge-evac', icon: '🏠', urgency: 'HIGH' },
  FOOD: { label: 'FOOD RATION RELIEF', badge: 'badge-food', icon: '🍱', urgency: 'STANDARD' },
  WATER: { label: 'DRINKING WATER SUPPLY', badge: 'badge-water', icon: '💧', urgency: 'STANDARD' },
};

export default function VolunteerPortal({ onSignOut }) {
  const { user, authFetch } = useAuth();

  const [activeAllocations, setActiveAllocations] = useState([]);
  const [completedAllocations, setCompletedAllocations] = useState([]);
  const [volunteerProfile, setVolunteerProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Fetch volunteer assignments and profile
  const loadVolunteerData = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, historyRes, profileRes] = await Promise.all([
        authFetch('/api/volunteers/me?status=ACTIVE'),
        authFetch('/api/volunteers/me?status=COMPLETED'),
        authFetch('/api/volunteers/profile'),
      ]);

      if (activeRes.ok) {
        const data = await activeRes.json();
        setActiveAllocations(data);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setCompletedAllocations(data);
      }
      if (profileRes.ok) {
        const data = await profileRes.json();
        setVolunteerProfile(data);
      }
    } catch (err) {
      console.warn('Volunteer data error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadVolunteerData();
    // Auto-poll every 5 seconds for new emergency dispatches
    const interval = setInterval(loadVolunteerData, 5000);
    return () => clearInterval(interval);
  }, [loadVolunteerData]);

  // Mark mission completed
  const handleCompleteMission = async (allocId) => {
    if (!window.confirm(`Confirm completion of allocation #${allocId}? This will release you back to AVAILABLE status.`)) {
      return;
    }

    setActionLoadingId(allocId);
    setFeedbackMsg(null);
    try {
      const res = await authFetch(`/api/allocations/${allocId}/complete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete mission');
      }

      setFeedbackMsg({
        type: 'success',
        text: `✓ Mission #${allocId} successfully marked as COMPLETED! Your status has been automatically updated to AVAILABLE.`,
      });
      await loadVolunteerData();
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: `⚠️ Error: ${err.message}`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const currentStatus = activeAllocations.length > 0 ? 'ASSIGNED' : (volunteerProfile?.availability_status || 'AVAILABLE');

  return (
    <div className="volunteer-app">
      {/* Volunteer Header */}
      <header className="user-header" style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div className="logo" style={{ color: 'var(--accent)', fontWeight: 800 }}>
            🤝 DRSCP VOLUNTEER DISPATCH
          </div>
          <span
            className="badge"
            style={{
              background: currentStatus === 'ASSIGNED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: currentStatus === 'ASSIGNED' ? '#f87171' : '#34d399',
              border: `1px solid ${currentStatus === 'ASSIGNED' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.25rem 0.65rem',
            }}
          >
            {currentStatus === 'ASSIGNED' ? '● ON ACTIVE MISSION' : '● AVAILABLE / STANDBY'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right', fontSize: '0.825rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>
              {volunteerProfile?.full_name || user.username}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Skill: <strong style={{ color: 'var(--accent)' }}>{volunteerProfile?.skill || 'FIRST RESPONDER'}</strong>
              {volunteerProfile?.agency_name && ` • ${volunteerProfile.agency_name}`}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadVolunteerData} disabled={loading} title="Refresh allocations">
            ↻ {loading ? 'Checking...' : 'Refresh'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="user-main" style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {/* Banner notification */}
        {feedbackMsg && (
          <div
            className="animate-fade-up"
            style={{
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius)',
              marginBottom: '1.5rem',
              background: feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
              color: feedbackMsg.type === 'success' ? '#6ee7b7' : '#fca5a5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{feedbackMsg.text}</span>
            <button
              onClick={() => setFeedbackMsg(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Volunteer Duty Summary Bar */}
        <div
          className="animate-fade-up"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>
              Volunteer Responder Console
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Assigned rescue, medical, and evacuation tasks dispatch directly to this portal with real-time victim details and locations.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className={`btn btn-sm ${activeTab === 'active' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('active')}
            >
              Current Active Allocations ({activeAllocations.length})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab('history')}
            >
              Completed Missions ({completedAllocations.length})
            </button>
          </div>
        </div>

        {/* TAB 1: Current Active Allocations */}
        {activeTab === 'active' && (
          <div>
            {activeAllocations.length === 0 ? (
              <div
                className="animate-fade-up"
                style={{
                  background: 'var(--surface)',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '3.5rem 2rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🟢</div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text)' }}>
                  No Active Allocations Assigned
                </h3>
                <p style={{ maxWidth: '540px', margin: '0 auto 1.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  You are currently marked as <strong style={{ color: '#34d399' }}>AVAILABLE</strong> on standby. When emergency operations managers dispatch tactical rescue or medical relief tasks to you, they will appear here automatically.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--accent)' }}>
                  <span style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}>↻</span>
                  Listening for real-time dispatch events...
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>⚠️</span> Active Tactical Mission ({activeAllocations.length} Assigned)
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Immediate response requested
                  </span>
                </div>

                {activeAllocations.map((alloc) => {
                  const typeConf = TYPE_CONFIG[alloc.request_type] || {
                    label: alloc.request_type,
                    badge: 'badge-rescue',
                    icon: '🚨',
                    urgency: 'HIGH',
                  };

                  return (
                    <div
                      key={alloc.allocation_id}
                      className="animate-fade-up"
                      style={{
                        background: 'var(--surface)',
                        border: '2px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: 'var(--radius)',
                        padding: '1.5rem',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '4px',
                          height: '100%',
                          background: 'var(--danger)',
                        }}
                      />

                      {/* Top Header of Card */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          marginBottom: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.75rem' }}>{typeConf.icon}</span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className={`badge ${typeConf.badge}`} style={{ fontWeight: 700 }}>
                                {typeConf.label}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Allocation #{alloc.allocation_id} • Request #{alloc.request_id}
                              </span>
                            </div>
                            <h4 style={{ fontSize: '1.15rem', marginTop: '0.25rem', color: 'var(--text)' }}>
                              Relief Mission for {alloc.requester_name}
                            </h4>
                          </div>
                        </div>

                        {/* Priority Score Display */}
                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.4rem 0.8rem',
                              display: 'inline-block',
                            }}
                          >
                            <span style={{ fontSize: '0.7rem', color: '#fca5a5', display: 'block', textTransform: 'uppercase' }}>
                              Priority Score
                            </span>
                            <strong style={{ fontSize: '1.2rem', color: '#f87171' }}>
                              {parseFloat(alloc.priority_score || 0).toFixed(1)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Distress description */}
                      {alloc.description && (
                        <div
                          style={{
                            background: 'var(--surface-2)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.85rem 1rem',
                            marginBottom: '1.25rem',
                            fontSize: '0.9rem',
                            color: '#e2e8f0',
                            borderLeft: '3px solid var(--accent)',
                          }}
                        >
                          <strong>Distress Situation:</strong> {alloc.description}
                        </div>
                      )}

                      {/* Details Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '1rem',
                          background: 'var(--surface-2)',
                          padding: '1rem',
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: '1.25rem',
                          fontSize: '0.875rem',
                        }}
                      >
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>
                            📍 LOCATION / ADDRESS
                          </span>
                          <strong style={{ color: 'var(--text)' }}>
                            {alloc.location_text || 'Location provided upon arrival'}
                          </strong>
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                            {alloc.district} District
                          </div>
                        </div>

                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>
                            📞 CITIZEN CONTACT
                          </span>
                          <a
                            href={`tel:${alloc.requester_phone}`}
                            style={{
                              color: 'var(--primary)',
                              fontWeight: 600,
                              textDecoration: 'underline',
                              display: 'inline-block',
                              marginTop: '0.15rem',
                            }}
                          >
                            {alloc.requester_phone || 'N/A'} ↗
                          </a>
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                            Household: <strong>{alloc.household_size || 1} person(s)</strong>
                          </div>
                        </div>

                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>
                            🚨 VULNERABILITY FLAGS
                          </span>
                          <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {alloc.vulnerabilities ? (
                              alloc.vulnerabilities.split(',').map((v) => (
                                <span
                                  key={v.trim()}
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    color: '#fbbf24',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    borderRadius: '4px',
                                    padding: '0.15rem 0.4rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  {v.trim()}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Standard triage</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>
                            ⏱️ ALLOCATED TIMESTAMP
                          </span>
                          <div style={{ color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                            {new Date(alloc.allocated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(alloc.allocated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '1rem',
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Status: <strong style={{ color: '#38bdf8' }}>ACTIVE FIELD ASSIGNMENT</strong>
                        </div>

                        <button
                          className="btn btn-success"
                          style={{
                            fontWeight: 700,
                            padding: '0.65rem 1.4rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                          disabled={actionLoadingId === alloc.allocation_id}
                          onClick={() => handleCompleteMission(alloc.allocation_id)}
                        >
                          {actionLoadingId === alloc.allocation_id ? 'Updating...' : '✓ Complete Mission & Set Available'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Completed Missions History */}
        {activeTab === 'history' && (
          <div className="animate-fade-up">
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-dim)' }}>
              Completed Missions Record ({completedAllocations.length})
            </h3>

            {completedAllocations.length === 0 ? (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '2.5rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                No completed missions recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {completedAllocations.map((h) => (
                  <div
                    key={h.allocation_id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                        <span className="badge badge-assigned" style={{ fontSize: '0.75rem' }}>
                          COMPLETED
                        </span>
                        <strong style={{ color: 'var(--text)' }}>
                          {h.request_type} for {h.requester_name}
                        </strong>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        📍 {h.location_text}, {h.district} • Priority Score: {parseFloat(h.priority_score || 0).toFixed(1)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div>Completed: {h.completed_at ? new Date(h.completed_at).toLocaleString() : 'Done'}</div>
                      <div>Allocated: {new Date(h.allocated_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
