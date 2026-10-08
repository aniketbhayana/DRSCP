import React from 'react';

export default function PortalSelector({ onSelect }) {
  return (
    <div className="portal-select-page">
      <div className="portal-select-header animate-fade-up">
        <div className="logo-mark">DRSCP</div>
        <p>Disaster Resource &amp; Shelter Coordination Platform</p>
      </div>

      <div className="portal-cards">
        {/* Admin Portal Card */}
        <div className="portal-card admin-card animate-fade-up anim-d1" onClick={() => onSelect('admin')}>
          <div className="portal-icon">🛡️</div>
          <h3>Admin &amp; Operations Center</h3>
          <p>Real-time tactical command: oversee allocations, shelter occupancy, stockpiles, and triage queue.</p>
          <button className="btn btn-primary btn-full">Operations Console →</button>
        </div>

        {/* Volunteer Portal Card */}
        <div className="portal-card volunteer-card animate-fade-up anim-d2" onClick={() => onSelect('volunteer')}>
          <div className="portal-icon">🤝</div>
          <h3>Volunteer Field Responder</h3>
          <p>Dedicated first-responder portal: view your current allocations, victim contacts, location, and complete missions.</p>
          <button className="btn btn-full" style={{ background: '#0284c7', color: '#fff' }}>
            Volunteer Console →
          </button>
        </div>

        {/* User / Requester Portal Card */}
        <div className="portal-card user-card animate-fade-up anim-d3" onClick={() => onSelect('user')}>
          <div className="portal-icon">🆘</div>
          <h3>Citizen Relief Portal</h3>
          <p>Submit emergency relief requirements with extra vulnerability flags (elder, wheelchair, infant) and live priority scoring.</p>
          <button className="btn btn-success btn-full">Request Relief →</button>
        </div>
      </div>
    </div>
  );
}
