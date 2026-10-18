import { useLocation } from 'react-router-dom'

const pageTitles = {
  '/': { title: 'Dashboard', subtitle: 'Biometric System Overview' },
  '/authenticate': { title: 'Verify Identity', subtitle: 'Live Multi-Stage Authentication' },
  '/register': { title: 'Enroll User', subtitle: 'Biometric Identity Registration' },
  '/users': { title: 'Registered Users', subtitle: 'FAISS 1:N Identity Database' },
  '/threat-monitor': { title: 'Threat Monitor', subtitle: 'Security Intelligence & Telemetry' },
  '/audit-logs': { title: 'Audit Logs', subtitle: 'Verification Security Trail' },
  '/system-status': { title: 'System Status', subtitle: 'Neural Models & Infrastructure Diagnostics' },
}

function Navbar({ onMenuClick, theme, onThemeToggle, backendStatus, onRefreshBackend }) {
  const location = useLocation()
  const page = pageTitles[location.pathname] || {
    title: 'Biometric Platform',
    subtitle: 'Enterprise Facial Recognition',
  }

  const isOnline = backendStatus?.online

  return (
    <nav className="navbar" id="main-navbar" aria-label="Main Navigation">
      <div className="navbar-left">
        <button
          className="navbar-menu-btn"
          onClick={onMenuClick}
          aria-label="Toggle Navigation Sidebar"
          id="menu-toggle-btn"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="navbar-title-group">
          <h2 className="navbar-title">{page.title}</h2>
          <span className="navbar-subtitle">{page.subtitle}</span>
        </div>
      </div>

      <div className="navbar-right">
        {/* Real Backend Connection Badge */}
        <div
          className={`navbar-badge ${isOnline ? 'navbar-badge-online' : 'navbar-badge-offline'}`}
          id="system-status-badge"
          title={isOnline ? `FastAPI v${backendStatus.version || '0.1.0'} connected` : 'Backend server unreachable. Verify port 8000.'}
          onClick={onRefreshBackend}
          style={{ cursor: 'pointer' }}
        >
          <span className={`status-indicator-dot ${isOnline ? 'online' : 'offline'}`} />
          <span>{backendStatus?.checked ? (isOnline ? 'API Connected' : 'API Offline') : 'Checking API...'}</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          className="theme-toggle"
          onClick={onThemeToggle}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="theme-icon"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="theme-icon"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          )}
          <span className="theme-toggle-label">
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </span>
        </button>
      </div>
    </nav>
  )
}

export default Navbar