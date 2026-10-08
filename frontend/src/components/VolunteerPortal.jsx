import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { safeJson } from '../utils/safeJson';

export default function VolunteerPortal({ onSignOut }) {
  const { user, authFetch } = useAuth();

  const [activeTasks, setActiveTasks] = useState([]);
  const [historyTasks, setHistoryTasks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('active'); // 'active' | 'history'
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, histRes, profRes] = await Promise.all([
        authFetch('/api/volunteers/me?status=ACTIVE'),
        authFetch('/api/volunteers/me?status=COMPLETED'),
        authFetch('/api/volunteers/profile'),
      ]);

      if (activeRes.ok) {
        const d = await safeJson(activeRes);
        if (Array.isArray(d)) setActiveTasks(d);
      }
      if (histRes.ok) {
        const d = await safeJson(histRes);
        if (Array.isArray(d)) setHistoryTasks(d);
      }
      if (profRes.ok) {
        const d = await safeJson(profRes);
        if (d && !d.error) setProfile(d);
      }
    } catch (err) {
      console.warn('Volunteer data load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 6000);
    return () => clearInterval(timer);
  }, [loadData]);

  const handleComplete = async (allocId) => {
    if (!window.confirm('Mark this task as completed? Your status will return to Available.')) {
      return;
    }

    setUpdatingId(allocId);
    setMessage(null);

    try {
      const res = await authFetch('/api/allocations/' + allocId + '/complete', {
        method: 'POST',
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error((data && data.error) || 'Could not update task');
      }

      setMessage({
        type: 'success',
        text: 'Task #' + allocId + ' marked as completed. You are now available for new tasks.',
      });
      loadData();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const isAssigned = activeTasks.length > 0;
  const statusLabel = isAssigned ? 'Assigned' : 'Available';

  return (
    <div className="volunteer-app">
      {/* Header Bar */}
      <header className="user-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="logo" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.15rem' }}>
            DRSCP Volunteer Dashboard
          </div>
          <span
            className="badge"
            style={{
              background: isAssigned ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: isAssigned ? 'var(--warning)' : 'var(--success)',
              border: isAssigned ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
              padding: '0.2rem 0.6rem',
              fontSize: '0.75rem',
            }}
          >
            {statusLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600 }}>{profile?.full_name || user?.username}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Skill: {profile?.skill || 'General Support'} {profile?.agency_name ? ' · ' + profile.agency_name : ''}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="user-main" style={{ maxWidth: '850px', margin: '2rem auto', padding: '0 1rem' }}>
        {/* Feedback Alert */}
        {message && (
          <div
            className="animate-fade-up"
            style={{
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
              background: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: message.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.9rem',
            }}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
            >
              ×
            </button>
          </div>
        )}

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <button
            className={'btn btn-sm ' + (tab === 'active' ? 'btn-primary' : 'btn-ghost')}
            onClick={() => setTab('active')}
          >
            Active Tasks ({activeTasks.length})
          </button>
          <button
            className={'btn btn-sm ' + (tab === 'history' ? 'btn-primary' : 'btn-ghost')}
            onClick={() => setTab('history')}
          >
            Past Completed Tasks ({historyTasks.length})
          </button>
        </div>

        {/* Active Tasks View */}
        {tab === 'active' && (
          <div>
            {activeTasks.length === 0 ? (
              <div
                className="card animate-fade-up"
                style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'var(--surface)' }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--success)' }}>✓</div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>No Tasks Currently Assigned</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto' }}>
                  You are marked as available. When a coordinator assigns a relief request to you, it will appear here with contact and location details.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeTasks.map((task) => (
                  <div
                    key={task.allocation_id}
                    className="card animate-fade-up"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '1.5rem',
                    }}
                  >
                    {/* Top Row: Type and Allocation Number */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span className="badge badge-pending" style={{ fontWeight: 600 }}>
                            {task.request_type}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Task #{task.allocation_id} · Request #{task.request_id}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1.15rem' }}>{task.requester_name}</h3>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {task.allocated_at ? new Date(task.allocated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Details Box */}
                    <div
                      style={{
                        background: 'var(--surface-2)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '1rem',
                        marginBottom: '1rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.75rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                          CONTACT NUMBER
                        </div>
                        <a
                          href={'tel:' + task.requester_phone}
                          style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
                        >
                          {task.requester_phone || 'Not provided'}
                        </a>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                          LOCATION & DISTRICT
                        </div>
                        <div style={{ fontWeight: 500 }}>{task.location_text || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{task.district}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                          HOUSEHOLD
                        </div>
                        <div>{task.household_size || 1} Person(s)</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                          CONDITIONS / VULNERABILITIES
                        </div>
                        <div>{task.vulnerabilities || 'None noted'}</div>
                      </div>
                    </div>

                    {/* Requester Description/Notes */}
                    {task.description && (
                      <div
                        style={{
                          background: 'var(--surface-3)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.75rem 1rem',
                          marginBottom: '1.25rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-dim)',
                        }}
                      >
                        <strong style={{ color: 'var(--text)' }}>Note from citizen:</strong> {task.description}
                      </div>
                    )}

                    {/* Action Button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        className="btn btn-success"
                        disabled={updatingId === task.allocation_id}
                        onClick={() => handleComplete(task.allocation_id)}
                      >
                        {updatingId === task.allocation_id ? 'Updating...' : 'Mark as Completed'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tasks View */}
        {tab === 'history' && (
          <div>
            {historyTasks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                No completed tasks on record yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {historyTasks.map((item) => (
                  <div
                    key={item.allocation_id}
                    className="card"
                    style={{
                      background: 'var(--surface)',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span className="badge badge-completed">Completed</span>
                        <strong>{item.request_type}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>for {item.requester_name}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {item.location_text}, {item.district}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>
                      {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '—'}
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
