import { useState, useEffect, useCallback } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { getAnalyticsOverview, getDetailedHealth, getVerificationHistory } from '../services/api'
import Breadcrumb from '../components/Breadcrumb'

function Home() {
  const { backendStatus, onRefreshBackend } = useOutletContext() || {}

  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [analyticsData, healthData, historyData] = await Promise.all([
        getAnalyticsOverview().catch(() => null),
        getDetailedHealth().catch(() => null),
        getVerificationHistory(10).catch(() => ({ history: [] })),
      ])

      setStats(analyticsData)
      setHealth(healthData)
      setRecentLogs(historyData?.history || [])
      setLastUpdated(new Date())

      if (!analyticsData && !healthData) {
        setError('FastAPI backend service is currently unreachable. Please verify server is running on port 8000.')
      }
    } catch (err) {
      console.error('Error fetching dashboard overview:', err)
      setError(err.message || 'Failed to load telemetry from backend.')
    } finally {
      setLoading(false)
      if (onRefreshBackend) onRefreshBackend()
    }
  }, [onRefreshBackend])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const isOnline = backendStatus?.online || (health && health.api_status === 'ONLINE')
  const totalVerifications = stats?.total_verifications ?? 0
  const enrolledCount = stats?.total_enrolled_users ?? backendStatus?.enrolled_faces ?? 0

  const getDecisionBadge = (decision, isAuth) => {
    if (isAuth) {
      return <span className="status-badge badge-success">Verified</span>
    }
    switch (decision) {
      case 'DEEPFAKE_SUSPECTED':
        return <span className="status-badge badge-purple">Deepfake</span>
      case 'LIVENESS_FAILED':
        return <span className="status-badge badge-danger">Spoof Detected</span>
      case 'UNKNOWN_PERSON':
        return <span className="status-badge badge-warning">Unrecognized</span>
      case 'POOR_QUALITY':
        return <span className="status-badge badge-warning">Low Quality</span>
      case 'NO_FACE':
        return <span className="status-badge badge-neutral">No Face</span>
      case 'MULTIPLE_FACES':
        return <span className="status-badge badge-warning">Multiple Faces</span>
      default:
        return <span className="status-badge badge-danger">Rejected</span>
    }
  }

  return (
    <div className="dashboard-container animate-in">
      <Breadcrumb items={[{ label: 'Dashboard' }]} />

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Enterprise Biometric Dashboard</h1>
          <p className="page-subtitle">
            Real-time biometric security metrics, enrolled identity index, and neural model readiness.
          </p>
        </div>

        <div className="header-actions-group">
          {lastUpdated && (
            <span className="last-updated-text">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchDashboardData}
            disabled={loading}
            id="refresh-dashboard-btn"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`btn-icon ${loading ? 'spin' : ''}`}
            >
              <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh Telemetry'}
          </button>
        </div>
      </div>

      {/* Backend Offline Warning Banner */}
      {error && (
        <div className="alert-banner alert-danger mb-20" role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="alert-content">
            <strong>Backend Connection Offline:</strong> {error}
          </div>
          <button className="btn btn-sm btn-secondary" onClick={fetchDashboardData}>
            Retry
          </button>
        </div>
      )}

      {/* 4 Primary Verified Telemetry KPI Cards */}
      <div className="metrics-grid mb-24">
        {/* Card 1: Enrolled Identities */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">ENROLLED IDENTITIES</span>
            <div className="metric-icon-box primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="metric-value">
            {loading && !stats ? '...' : enrolledCount}
          </div>
          <div className="metric-footer">
            <span className="status-indicator-dot online" />
            <span className="metric-caption">
              {enrolledCount === 0 ? 'No identities enrolled' : `${enrolledCount} Vector Index Profiles`}
            </span>
          </div>
        </div>

        {/* Card 2: Total Verification Attempts */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">TOTAL ATTEMPTS</span>
            <div className="metric-icon-box info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
          </div>
          <div className="metric-value">
            {loading && !stats ? '...' : totalVerifications}
          </div>
          <div className="metric-footer">
            <span className="metric-caption">
              {totalVerifications === 0
                ? 'Recorded in audit store'
                : `${stats?.successful_verifications || 0} Successful Authentications`}
            </span>
          </div>
        </div>

        {/* Card 3: Authentication Reliability */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">SUCCESS RATE</span>
            <div className="metric-icon-box success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div className="metric-value">
            {loading && !stats
              ? '...'
              : totalVerifications > 0
              ? `${stats.success_rate_percent}%`
              : 'N/A'}
          </div>
          <div className="metric-footer">
            <span className="metric-caption">
              {totalVerifications > 0
                ? `${stats.successful_verifications} of ${totalVerifications} Verified`
                : 'Awaiting verification attempts'}
            </span>
          </div>
        </div>

        {/* Card 4: Average Pipeline Latency */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">PIPELINE LATENCY</span>
            <div className="metric-icon-box warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="metric-value">
            {loading && !stats
              ? '...'
              : totalVerifications > 0 && stats.avg_verification_time_ms > 0
              ? `${stats.avg_verification_time_ms} ms`
              : 'N/A'}
          </div>
          <div className="metric-footer">
            <span className="metric-caption">
              {totalVerifications > 0 && stats.avg_verification_time_ms > 0
                ? 'Detection + Embedding + FAISS'
                : 'Awaiting pipeline execution'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid Row: Pipeline Status & Security Incident Telemetry */}
      <div className="dashboard-grid-2 mb-24">
        {/* Left: Verified AI & Infrastructure Pipeline */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-title-group">
              <h3 className="card-title">AI Biometric Pipeline Status</h3>
              <p className="card-subtitle">Verified status of neural models, vector search, and storage</p>
            </div>
            <span className={`status-badge ${isOnline ? 'badge-success' : 'badge-danger'}`}>
              {isOnline ? 'Pipeline Active' : 'Offline'}
            </span>
          </div>

          <div className="pipeline-table-wrapper">
            <div className="pipeline-item">
              <div className="pipeline-item-info">
                <div className="pipeline-item-name">FastAPI REST Server</div>
                <div className="pipeline-item-desc">REST API endpoints & CORS gateway</div>
              </div>
              <span className={`status-badge ${health?.api_status === 'ONLINE' ? 'badge-success' : 'badge-danger'}`}>
                {health?.api_status || (isOnline ? 'ONLINE' : 'OFFLINE')}
              </span>
            </div>

            <div className="pipeline-item">
              <div className="pipeline-item-info">
                <div className="pipeline-item-name">FAISS Vector Store</div>
                <div className="pipeline-item-desc">IndexFlatIP 512d L2 normalized cosine matching</div>
              </div>
              <span className={`status-badge ${health?.database_status === 'ONLINE' ? 'badge-success' : 'badge-danger'}`}>
                {health?.database_status || (isOnline ? 'ONLINE' : 'OFFLINE')}
              </span>
            </div>

            <div className="pipeline-item">
              <div className="pipeline-item-info">
                <div className="pipeline-item-name">MTCNN Face Detector</div>
                <div className="pipeline-item-desc">Multi-task Cascaded PyTorch CNN (P-Net, R-Net, O-Net)</div>
              </div>
              <span className={`status-badge ${health?.face_detection_model_status === 'ONLINE' ? 'badge-success' : 'badge-warning'}`}>
                {health?.face_detection_model_status || 'CHECKING'}
              </span>
            </div>

            <div className="pipeline-item">
              <div className="pipeline-item-info">
                <div className="pipeline-item-name">InceptionResNetV1 (ArcFace)</div>
                <div className="pipeline-item-desc">Deep residual feature extractor pretrained on VGGFace2</div>
              </div>
              <span className={`status-badge ${health?.face_embedding_model_status === 'ONLINE' ? 'badge-success' : 'badge-warning'}`}>
                {health?.face_embedding_model_status || 'CHECKING'}
              </span>
            </div>

            <div className="pipeline-item">
              <div className="pipeline-item-info">
                <div className="pipeline-item-name">LivenessNet Anti-Spoofing</div>
                <div className="pipeline-item-desc">Passive 2D print & screen replay attack classifier</div>
              </div>
              <span className={`status-badge ${health?.liveness_model_status === 'ONLINE' ? 'badge-success' : 'badge-warning'}`}>
                {health?.liveness_model_status || 'CHECKING'}
              </span>
            </div>

            <div className="pipeline-item">
              <div className="pipeline-item-info">
                <div className="pipeline-item-name">DeepfakeNet Synthetic Detector</div>
                <div className="pipeline-item-desc">Face-swap & GAN artifact analyzer (Initialized mode)</div>
              </div>
              <span className={`status-badge ${health?.deepfake_model_status === 'ONLINE' ? 'badge-success' : 'badge-neutral'}`}>
                {health?.deepfake_model_status || 'UNAVAILABLE'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Security Incident Telemetry */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-title-group">
              <h3 className="card-title">Security Incident Telemetry</h3>
              <p className="card-subtitle">Actual counts aggregated from verification audit logs</p>
            </div>
            <span className="status-badge badge-neutral">Live Audit</span>
          </div>

          <div className="incident-cards-stack">
            <div className="incident-row warning-border">
              <div className="incident-icon-box warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="incident-content">
                <div className="incident-title">Unrecognized Identity Attempts</div>
                <div className="incident-desc">Faces below cosine similarity threshold</div>
              </div>
              <div className="incident-count warning-text">
                {stats?.unknown_user_attempts ?? 0}
              </div>
            </div>

            <div className="incident-row danger-border">
              <div className="incident-icon-box danger">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="incident-content">
                <div className="incident-title">Liveness Spoof Detections</div>
                <div className="incident-desc">Presentation attacks intercepted by LivenessNet</div>
              </div>
              <div className="incident-count danger-text">
                {stats?.liveness_failures ?? 0}
              </div>
            </div>

            <div className="incident-row purple-border">
              <div className="incident-icon-box purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="incident-content">
                <div className="incident-title">Deepfake Suspicion Events</div>
                <div className="incident-desc">Synthetic face manipulation flags</div>
              </div>
              <div className="incident-count purple-text">
                {stats?.deepfake_suspected_attempts ?? 0}
              </div>
            </div>
          </div>

          <div className="card-footer-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mini-icon">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Telemetry reflects real stored audit records. No simulated events.</span>
          </div>
        </div>
      </div>

      {/* Recent Verification Activity (Real Records) */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-header-title-group">
            <h3 className="card-title">Recent Authentication Activity</h3>
            <p className="card-subtitle">Chronological record of recent biometric verification queries</p>
          </div>
          <Link to="/audit-logs" className="btn btn-secondary btn-sm" id="view-all-logs-btn">
            View Complete Audit Trail →
          </Link>
        </div>

        {loading && recentLogs.length === 0 ? (
          <div className="empty-state-box">
            <div className="spin mb-8">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin-icon">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
              </svg>
            </div>
            <p>Loading verification audit records...</p>
          </div>
        ) : recentLogs.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h4 className="empty-state-title">No Verification Records Found</h4>
            <p className="empty-state-text">
              No authentication events have been recorded in the audit store yet.
              Execute a face verification test to populate live security telemetry.
            </p>
            <Link to="/authenticate" className="btn btn-primary btn-sm mt-12" id="empty-verify-cta-btn">
              Launch Verify Identity
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Identified Person</th>
                  <th>Decision</th>
                  <th>Similarity</th>
                  <th>Liveness</th>
                  <th>Pipeline Latency</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, index) => (
                  <tr key={log.id || index}>
                    <td className="timestamp-cell">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                    </td>
                    <td className="identity-cell">
                      <strong>{log.identity || 'Unauthenticated'}</strong>
                      {log.user_id && <span className="user-id-sub">ID: {log.user_id}</span>}
                    </td>
                    <td>{getDecisionBadge(log.final_decision, log.is_authenticated)}</td>
                    <td className="metric-cell">
                      {log.similarity_score !== undefined ? `${((log.similarity_score || 0) * 100).toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="metric-cell">
                      {log.liveness_score !== undefined ? `${((log.liveness_score || 0) * 100).toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="latency-cell">
                      {log.timing_ms?.total_ms ? `${log.timing_ms.total_ms} ms` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Primary Actions Navigation Grid */}
      <div className="section-heading mb-16">
        <h3>Platform Management Modules</h3>
      </div>
      <div className="quick-actions-grid">
        <Link to="/authenticate" className="action-card" id="home-action-verify">
          <div className="action-icon-box primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div className="action-content">
            <h4>Verify Identity</h4>
            <p>Live camera and upload facial verification against 1:N FAISS database.</p>
          </div>
          <span className="action-arrow">→</span>
        </Link>

        <Link to="/register" className="action-card" id="home-action-enroll">
          <div className="action-icon-box info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="16" y1="11" x2="22" y2="11" />
            </svg>
          </div>
          <div className="action-content">
            <h4>Enroll User</h4>
            <p>Register a new identity with anti-spoofing and ArcFace 512d vectors.</p>
          </div>
          <span className="action-arrow">→</span>
        </Link>

        <Link to="/users" className="action-card" id="home-action-users">
          <div className="action-icon-box success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="action-content">
            <h4>Registered Users</h4>
            <p>Search, inspect, and manage identities enrolled in the vector store.</p>
          </div>
          <span className="action-arrow">→</span>
        </Link>

        <Link to="/audit-logs" className="action-card" id="home-action-audit">
          <div className="action-icon-box warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="action-content">
            <h4>Audit Logs</h4>
            <p>Full compliance trail with decision explanations, timestamps, and filters.</p>
          </div>
          <span className="action-arrow">→</span>
        </Link>

        <Link to="/system-status" className="action-card" id="home-action-status">
          <div className="action-icon-box neutral">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="action-content">
            <h4>System Diagnostics</h4>
            <p>Deep hardware, neural net readiness, threshold settings, and latency.</p>
          </div>
          <span className="action-arrow">→</span>
        </Link>
      </div>
    </div>
  )
}

export default Home
