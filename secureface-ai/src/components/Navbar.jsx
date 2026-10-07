import { useLocation } from 'react-router-dom'

const pageTitles = {
  '/': { title: 'Dashboard', subtitle: 'System Overview' },
  '/register': { title: 'Register User', subtitle: 'Enroll New Identity' },
  '/authenticate': { title: 'Live Authentication', subtitle: 'Verify Identity' },
  '/users': { title: 'Registered Users', subtitle: 'Identity Database' },
  '/threat-monitor': { title: 'Threat Monitor', subtitle: 'Security Analytics' },
}

function Navbar({ onMenuClick, theme, onThemeToggle }) {
  const location = useLocation()
  const page = pageTitles[location.pathname] || pageTitles['/']

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-left">
        <button
          className="navbar-menu-btn"
          onClick={onMenuClick}
          aria-label="Toggle menu"
          id="menu-toggle-btn"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <h2 className="navbar-title">{page.title}</h2>
        <span className="navbar-subtitle">{page.subtitle}</span>
      </div>

      <div className="navbar-right">

        {/* Theme Toggle */}
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

          <span>
            {theme === 'light' ? 'Dark' : 'Light'}
          </span>
        </button>

        {/* System Status */}
        <div className="navbar-badge" id="system-status-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="5" />
          </svg>
          System Online
        </div>
      </div>
    </nav>
  )
}

export default Navbar