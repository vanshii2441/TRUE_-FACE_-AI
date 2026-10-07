import { useState, useEffect, useCallback } from 'react'
import { getDetailedHealth, getThresholds, updateThresholds, adminLogin } from '../services/api'

function SystemStatus() {
  const [health, setHealth] = useState(null)
  const [thresholds, setThresholds] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Admin Auth state
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('trueface_admin_token') || '')
  const [adminUser, setAdminUser] = useState(() => localStorage.getItem('trueface_admin_user') || '')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' })
  const [loginError, setLoginError] = useState(null)

  // Threshold edit state
  const [savingThresholds, setSavingThresholds] = useState(false)
  const [thresholdMsg, setThresholdMsg] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [hData, tData] = await Promise.all([getDetailedHealth(), getThresholds()])
      setHealth(hData)
      setThresholds(tData)
    } catch (err) {
      console.error('Failed to load system status:', err)
      setError('Unable to connect to backend server. Please verify FastAPI backend is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAdminLogin = async (e) => {
    e.preventDefault()
    setLoginError(null)
    try {
      const res = await adminLogin(loginForm.username, loginForm.password)
      setAdminToken(res.access_token)
      setAdminUser(res.username)
      localStorage.setItem('trueface_admin_token', res.access_token)
      localStorage.setItem('trueface_admin_user', res.username)
      setShowLoginModal(false)
    } catch (err) {
      setLoginError(err.message || 'Invalid administrator password.')
    }
  }

  const handleAdminLogout = () => {
    setAdminToken('')
    setAdminUser('')
    localStorage.removeItem('trueface_admin_token')
    localStorage.removeItem('trueface_admin_user')
  }

  const handleSaveThresholds = async () => {
    if (!adminToken) {
      setShowLoginModal(true)
      return
    }

    setSavingThresholds(true)
    setThresholdMsg(null)
    try {
      const updated = await updateThresholds(thresholds, adminToken)
      setThresholds(updated)
      setThresholdMsg('Threshold parameters successfully updated!')
      setTimeout(() => setThresholdMsg(null), 4000)
    } catch (err) {
      console.error('Threshold update error:', err)
      setThresholdMsg(`Error: ${err.message}`)
    } finally {
      setSavingThresholds(false)
    }
  }

  const getStatusBadge = (st) => {
    switch (st) {
      case 'ONLINE':
        return <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}>🟢 ONLINE</span>
      case 'DEGRADED':
        return <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}>🟡 DEGRADED</span>
      case 'MODEL_UNAVAILABLE':
        return <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}>⚠️ MODEL UNAVAILABLE</span>
      default:
        return <span className="badge badge-danger" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}>🔴 OFFLINE</span>
    }
  }

  return (
    <div className="animate-in" style={{ paddingBottom: '40px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>System Status & Health Monitor</h1>
          <p>Real-time load status of FastAPI endpoints, FAISS vector index, MTCNN, InceptionResnetV1, LivenessNet & DeepfakeNet.</p>
        </div>

        {/* Admin Auth Status Bar */}
        <div>
          {adminToken ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16,185,129,0.1)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)' }}>
              <span style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: '#10b981' }}>
                🔑 Authenticated Admin ({adminUser})
              </span>
              <button className="btn btn-secondary btn-sm" onClick={handleAdminLogout} style={{ padding: '4px 10px', fontSize: '11px' }}>
                Logout
              </button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setShowLoginModal(true)}>
              🔑 Admin Login
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', marginBottom: '24px' }}>
          ⚠️ <strong>System Connection Alert:</strong> {error}
        </div>
      )}

      {/* System Health Grid */}
      <div className="card mb-24">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <span className="card-title">Component Readiness & Health Matrix</span>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>
            🔄 Refresh Status
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading system diagnostics...</div>
        ) : health ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '12px' }}>
            {/* Server API Status */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>FastAPI Web Server</span>
              <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, margin: '4px 0 8px 0', color: 'var(--text-primary)' }}>REST API Server</h3>
              {getStatusBadge(health.api_status)}
            </div>

            {/* FAISS Vector Store Status */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>FAISS Vector Store</span>
              <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, margin: '4px 0 4px 0', color: 'var(--text-primary)' }}>1:N Identity Database</h3>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Total Enrolled Vectors: <strong>{health.enrolled_faces_count}</strong>
              </p>
              {getStatusBadge(health.database_status)}
            </div>

            {/* MTCNN Detector */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Face Detection</span>
              <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, margin: '4px 0 8px 0', color: 'var(--text-primary)' }}>MTCNN Neural Network</h3>
              {getStatusBadge(health.face_detection_model_status)}
            </div>

            {/* InceptionResnetV1 Embedder */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Face Embedding</span>
              <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, margin: '4px 0 8px 0', color: 'var(--text-primary)' }}>InceptionResnetV1 (ArcFace 512d)</h3>
              {getStatusBadge(health.face_embedding_model_status)}
            </div>

            {/* LivenessNet CNN */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Anti-Spoofing</span>
              <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, margin: '4px 0 8px 0', color: 'var(--text-primary)' }}>LivenessNet CNN</h3>
              {getStatusBadge(health.liveness_model_status)}
            </div>

            {/* DeepfakeNet CNN */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Synthetic Detection</span>
              <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, margin: '4px 0 8px 0', color: 'var(--text-primary)' }}>DeepfakeNet CNN</h3>
              {getStatusBadge(health.deepfake_model_status)}
            </div>
          </div>
        ) : null}
      </div>

      {/* Threshold Parameter Control Card */}
      {thresholds && (
        <div className="card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="card-icon warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" />
                </svg>
              </div>
              <div>
                <span className="card-title">Centralized Threshold Configuration</span>
                <span style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  Tune decision gating parameters. Requires Admin authentication to persist changes.
                </span>
              </div>
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveThresholds}
              disabled={savingThresholds}
            >
              {savingThresholds ? 'Saving...' : '💾 Update Thresholds'}
            </button>
          </div>

          {thresholdMsg && (
            <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: thresholdMsg.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: thresholdMsg.startsWith('Error') ? '#ef4444' : '#10b981', fontSize: 'var(--font-xs)', fontWeight: 600 }}>
              {thresholdMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {/* Face Similarity Match Cutoff */}
            <div>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Face Similarity Threshold (0.0 to 1.0)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.0"
                max="1.0"
                className="input"
                value={thresholds.face_match_threshold}
                onChange={(e) => setThresholds({ ...thresholds, face_match_threshold: parseFloat(e.target.value) || 0.6 })}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default: 0.60 (Cosine similarity)</span>
            </div>

            {/* Liveness Cutoff */}
            <div>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Liveness Cutoff (0.0 to 1.0)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.0"
                max="1.0"
                className="input"
                value={thresholds.liveness_threshold}
                onChange={(e) => setThresholds({ ...thresholds, liveness_threshold: parseFloat(e.target.value) || 0.7 })}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default: 0.70 (Anti-spoof probability)</span>
            </div>

            {/* Deepfake Cutoff */}
            <div>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Deepfake Cutoff (0.0 to 1.0)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.0"
                max="1.0"
                className="input"
                value={thresholds.deepfake_threshold}
                onChange={(e) => setThresholds({ ...thresholds, deepfake_threshold: parseFloat(e.target.value) || 0.5 })}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default: 0.50 (Synthetic probability)</span>
            </div>

            {/* Blur Laplacian Variance */}
            <div>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Blur Threshold (Laplacian Variance)
              </label>
              <input
                type="number"
                step="5.0"
                min="0.0"
                className="input"
                value={thresholds.blur_threshold}
                onChange={(e) => setThresholds({ ...thresholds, blur_threshold: parseFloat(e.target.value) || 30.0 })}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default: 30.0</span>
            </div>

            {/* Min Face Size */}
            <div>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Min Face Size (Pixels)
              </label>
              <input
                type="number"
                step="5"
                min="20"
                className="input"
                value={thresholds.min_face_size}
                onChange={(e) => setThresholds({ ...thresholds, min_face_size: parseInt(e.target.value) || 40 })}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Default: 40px square</span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card animate-in" style={{ maxWidth: '400px', width: '100%', padding: '28px' }}>
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, marginBottom: '6px' }}>🔑 Admin Authentication</h2>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Authenticate with administrator credentials to modify system security settings.
            </p>

            {loginError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 'var(--font-xs)', marginBottom: '14px' }}>
                ⚠️ {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLogin}>
              <div className="form-group mb-16">
                <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Username</label>
                <input
                  type="text"
                  className="input"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group mb-20">
                <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Enter admin password (default: admin123)"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  required
                  id="admin-password-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowLoginModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Login & Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SystemStatus
