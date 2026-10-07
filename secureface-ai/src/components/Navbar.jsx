import { useLocation } from 'react-router-dom'

const pageTitles = {
  '/': { title: 'Dashboard', subtitle: 'System Overview' },
  '/register': { title: 'Enroll User', subtitle: 'Biometric Registration' },
  '/authenticate': { title: 'Verify Identity', subtitle: 'Live Face Verification' },
  '/users': { title: 'Registered Users', subtitle: 'Identity Database' },
  '/audit-logs': { title: 'Audit Logs', subtitle: 'Security Event History' },
  '/system-status': { title: 'System Status', subtitle: 'Model & Pipeline Health' },
}


function Navbar({ onMenuClick }) {
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <h2 className="navbar-title">{page.title}</h2>
        <span className="navbar-subtitle">{page.subtitle}</span>
      </div>

      <div className="navbar-right">
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
