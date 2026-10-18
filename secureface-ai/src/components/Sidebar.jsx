import { NavLink } from 'react-router-dom'

const mainNav = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    to: '/authenticate',
    label: 'Verify Identity',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    to: '/register',
    label: 'Enroll User',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="16" y1="11" x2="22" y2="11" />
      </svg>
    ),
  },
  {
    to: '/users',
    label: 'Registered Users',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/threat-monitor',
    label: 'Threat Monitor',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    to: '/audit-logs',
    label: 'Audit Logs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    to: '/system-status',
    label: 'System Status',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
]

const plannedNav = [
  {
    label: 'Attack Simulation',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="22" y1="12" x2="18" y2="12" />
        <line x1="6" y1="12" x2="2" y2="12" />
        <line x1="12" y1="6" x2="12" y2="2" />
        <line x1="12" y1="22" x2="12" y2="18" />
      </svg>
    ),
  },
  {
    label: 'Security Policies',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
]

function Sidebar({ isOpen, onClose, backendStatus }) {
  const isOnline = backendStatus?.online

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        id="sidebar-overlay"
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="main-sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="sidebar-brand-text">
            <h1>TRUE FACE AI</h1>
            <span>Biometric Security</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* Main Navigation */}
        <div className="sidebar-section-label">MAIN NAVIGATION</div>
        <nav className="sidebar-nav">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={onClose}
              id={`nav-${item.to.replace('/', '') || 'dashboard'}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-divider" />

        {/* Planned Modules (Clearly marked as coming soon) */}
        <div className="sidebar-section-label">PLANNED MODULES</div>
        <nav className="sidebar-nav">
          {plannedNav.map((item) => (
            <div
              key={item.label}
              className="sidebar-link disabled"
              title={`${item.label} is planned for future release`}
            >
              <div className="sidebar-disabled-content">
                <span className="sidebar-link-icon">{item.icon}</span>
                <span className="sidebar-link-text">{item.label}</span>
              </div>
              <span className="planned-badge">Soon</span>
            </div>
          ))}
        </nav>

        {/* Real Backend Infrastructure Status in Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-header">
            <span>INFRASTRUCTURE</span>
            <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? 'Operational' : 'Disconnected'}
            </span>
          </div>
          <div className="sidebar-status-item">
            <span className={`status-indicator-dot ${isOnline ? 'online' : 'offline'}`} />
            <span>FastAPI Server: {backendStatus?.checked ? (isOnline ? 'Online' : 'Offline') : 'Checking...'}</span>
          </div>
          <div className="sidebar-status-item">
            <span className={`status-indicator-dot ${isOnline ? 'online' : 'offline'}`} />
            <span>FAISS Index: {isOnline ? `${backendStatus.enrolled_faces || 0} Faces` : 'N/A'}</span>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
