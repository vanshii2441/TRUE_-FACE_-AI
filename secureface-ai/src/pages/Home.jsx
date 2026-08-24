import { Link } from 'react-router-dom'

const features = [
  {
    icon: '🔍',
    title: 'Face Recognition',
    description: 'Deep learning-based 1:N facial matching with high-speed biometric search across user databases.',
    iconBg: 'primary',
    status: 'Phase 1',
  },
  {
    icon: '🛡️',
    title: 'Liveness Detection',
    description: 'CNN-based passive anti-spoofing to block printed photos, video replays, and 3D mask attacks.',
    iconBg: 'success',
    status: 'Planned',
  },
  {
    icon: '🤖',
    title: 'Deepfake Detection',
    description: 'Vision Transformer architecture to identify AI-generated synthetic media and face swaps.',
    iconBg: 'info',
    status: 'Planned',
  },
  {
    icon: '⚡',
    title: 'Vector Search',
    description: 'FAISS-powered similarity search for sub-second identity matching across million-scale databases.',
    iconBg: 'warning',
    status: 'Planned',
  },
]

const systemStatus = [
  { label: 'React Frontend', status: 'online', badge: 'Active' },
  { label: 'FastAPI Backend', status: 'pending', badge: 'Pending' },
  { label: 'AI Models', status: 'offline', badge: 'Not Loaded' },
  { label: 'Vector Database', status: 'offline', badge: 'Not Connected' },
]

function Home() {
  return (
    <div className="animate-in">
      {/* Hero Section */}
      <div className="page-header">
        <h1>
          <span className="gradient-text">True Face AI</span>
        </h1>
        <p style={{ fontSize: 'var(--font-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
          AI-Powered Biometric Security System
        </p>
        <p>
          Enterprise-grade facial authentication platform combining deep learning face recognition,
          multi-layered liveness detection, and deepfake protection — authenticating real users
          while blocking spoofing attempts in real time.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="section-title">Quick Actions</div>
      <div className="quick-actions mb-24">
        <Link to="/register" className="btn btn-primary" id="action-register">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="16" y1="11" x2="22" y2="11" />
          </svg>
          Register User
        </Link>
        <Link to="/authenticate" className="btn btn-secondary" id="action-authenticate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Live Authentication
        </Link>
        <Link to="/users" className="btn btn-secondary" id="action-users">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          View Users
        </Link>
      </div>

      {/* Platform Capabilities */}
      <div className="section-title">Platform Capabilities</div>
      <div className="grid-4 mb-24">
        {features.map((feature, index) => (
          <div
            className={`feature-card animate-in animate-delay-${index + 1}`}
            key={feature.title}
          >
            <div className={`feature-card-icon card-icon ${feature.iconBg}`}>
              <span style={{ fontSize: '1.4rem' }}>{feature.icon}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <h3 style={{ margin: 0 }}>{feature.title}</h3>
              <span className={`badge ${feature.status === 'Phase 1' ? 'badge-success' : 'badge-neutral'}`}>
                {feature.status}
              </span>
            </div>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>

      {/* System Status */}
      <div className="section-title">System Status</div>
      <div className="card">
        <div className="status-list">
          {systemStatus.map((item) => (
            <div className="status-item" key={item.label}>
              <div className="status-item-left">
                <span className={`status-dot ${item.status}`} />
                <span className="status-item-label">{item.label}</span>
              </div>
              <span className={`badge ${
                item.status === 'online' ? 'badge-success' :
                item.status === 'pending' ? 'badge-warning' :
                'badge-neutral'
              }`}>
                {item.badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Home
