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
          <h3>Admin &amp; Operations Portal</h3>
          <p>Real-time command center: oversee who is allocated where, shelter occupancy, inventory stock, and volunteer dispatch.</p>
          <button className="btn btn-primary btn-full">Enter Admin Portal →</button>
        </div>

        {/* User / Requester Portal Card */}
        <div className="portal-card user-card animate-fade-up anim-d2" onClick={() => onSelect('user')}>
          <div className="portal-icon">🆘</div>
          <h3>Citizen Relief Request Portal</h3>
          <p>Submit emergency relief requirements and receive immediate automated assignment according to priority formulas.</p>
          <button className="btn btn-success btn-full">Request Emergency Relief →</button>
        </div>
      </div>
    </div>
  );
}
