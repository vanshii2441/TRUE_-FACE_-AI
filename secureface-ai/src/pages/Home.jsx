import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getAnalyticsOverview, getDetailedHealth } from '../services/api'

function Home() {
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [analyticsData, healthData] = await Promise.all([
        getAnalyticsOverview(),
        getDetailedHealth(),
      ])
      setStats(analyticsData)
      setHealth(healthData)
    } catch (err) {
      console.error('Error fetching dashboard overview:', err)
      setError('Backend server disconnected. Please verify FastAPI backend service is active.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  return (
    <div className="animate-in" style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div className="page-header">
        <h1>
          <span className="gradient-text">True Face AI</span> Admin Dashboard
        </h1>
        <p>
          Real-time biometric security metrics, user enrollment analytics, AI model readiness matrix, and authentication performance indicators.
        </p>
      </div>

      {error && (
        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', marginBottom: '24px' }}>
          ⚠️ <strong>Dashboard Connection Alert:</strong> {error}
        </div>
      )}

      {/* Primary Analytics Metric Cards */}
      <div className="section-title">Biometric System Analytics Overview</div>
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading real-time system metrics...
        </div>
      ) : stats ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {/* Total Enrolled Users */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>ENROLLED USERS</span>
              <span className="card-icon primary" style={{ width: '32px', height: '32px', fontSize: '14px' }}>👥</span>
            </div>
            <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
              {stats.total_enrolled_users}
            </div>
            <span style={{ fontSize: 'var(--font-xs)', color: '#10b981', fontWeight: 600, marginTop: '4px', display: 'block' }}>
              ● {stats.active_users} Active Identities
            </span>
          </div>

          {/* Total Verifications */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL ATTEMPTS</span>
              <span className="card-icon info" style={{ width: '32px', height: '32px', fontSize: '14px' }}>🔍</span>
            </div>
            <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
              {stats.total_verifications}
            </div>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Recorded in audit store
            </span>
          </div>

          {/* Success Rate */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>SUCCESS RATE</span>
              <span className="card-icon success" style={{ width: '32px', height: '32px', fontSize: '14px' }}>✅</span>
            </div>
            <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 800, color: '#10b981' }}>
              {stats.success_rate_percent}%
            </div>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              {stats.successful_verifications} authenticated matches
            </span>
          </div>

          {/* Avg Latency */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>AVG LATENCY</span>
              <span className="card-icon warning" style={{ width: '32px', height: '32px', fontSize: '14px' }}>⚡</span>
            </div>
            <div style={{ fontSize: 'var(--font-3xl)', fontWeight: 800, color: 'var(--primary)' }}>
              {stats.avg_verification_time_ms} ms
            </div>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              End-to-end pipeline time
            </span>
          </div>
        </div>
      ) : null}

      {/* Security Incident Counters */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.05)' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Unknown User Attempts</span>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>
              ❓ {stats.unknown_user_attempts} Unrecognized
            </div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid #ef4444', background: 'rgba(239,68,68,0.05)' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Liveness Spoof Alerts</span>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>
              🚫 {stats.liveness_failures} Presentation Attacks
            </div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid #8b5cf6', background: 'rgba(139,92,246,0.05)' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Deepfake Synthetic Alerts</span>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: '#8b5cf6', marginTop: '4px' }}>
              🤖 {stats.deepfake_suspected_attempts} AI Manipulations
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="section-title">Primary Navigation</div>
      <div className="quick-actions mb-24">
        <Link to="/authenticate" className="btn btn-primary" id="action-verify-identity">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Verify Identity
        </Link>
        <Link to="/register" className="btn btn-secondary" id="action-enroll-user">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
          </svg>
          Enroll User
        </Link>
        <Link to="/users" className="btn btn-secondary" id="action-view-users">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          Manage Users
        </Link>
        <Link to="/audit-logs" className="btn btn-secondary" id="action-audit-logs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Audit Logs
        </Link>
        <Link to="/system-status" className="btn btn-secondary" id="action-system-status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          System Status
        </Link>
      </div>

      {/* System Health Summary Bar */}
      {health && (
        <div className="card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <span className="card-title">Live System Status</span>
            <span className={`badge ${health.status === 'ONLINE' ? 'badge-success' : 'badge-warning'}`}>
              {health.status}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px' }}>
            <div>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>FastAPI Server</span>
              <p style={{ fontWeight: 700, margin: 0, color: '#10b981' }}>{health.api_status}</p>
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>FAISS Vector Store</span>
              <p style={{ fontWeight: 700, margin: 0, color: '#10b981' }}>{health.database_status}</p>
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Face Detection (MTCNN)</span>
              <p style={{ fontWeight: 700, margin: 0, color: health.face_detection_model_status === 'ONLINE' ? '#10b981' : '#f59e0b' }}>
                {health.face_detection_model_status}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>LivenessNet Anti-Spoofing</span>
              <p style={{ fontWeight: 700, margin: 0, color: health.liveness_model_status === 'ONLINE' ? '#10b981' : '#f59e0b' }}>
                {health.liveness_model_status}
              </p>
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>DeepfakeNet Synthetic</span>
              <p style={{ fontWeight: 700, margin: 0, color: health.deepfake_model_status === 'ONLINE' ? '#10b981' : '#f59e0b' }}>
                {health.deepfake_model_status}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home
