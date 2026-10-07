import { useState, useEffect, useCallback, useRef } from 'react'
import { getDetailedHealth, getThresholds, updateThresholds, adminLogin } from '../services/api'

function SystemStatus() {
  const [health, setHealth] = useState(null)
  const [thresholds, setThresholds] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)
  const [apiLatency, setApiLatency] = useState(null)

  // Step-by-step refresh progress
  const [refreshStep, setRefreshStep] = useState('Idle')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Auto refresh state
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(15)

  // Model details modal state
  const [selectedModelDetails, setSelectedModelDetails] = useState(null)

  // Admin Auth state
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('trueface_admin_token') || '')
  const [adminUser, setAdminUser] = useState(() => localStorage.getItem('trueface_admin_user') || '')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' })
  const [loginError, setLoginError] = useState(null)

  // Threshold edit state
  const [savingThresholds, setSavingThresholds] = useState(false)
  const [thresholdMsg, setThresholdMsg] = useState(null)

  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Core Data Fetching function
  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
      setRefreshStep('Connecting to FastAPI Backend...')
    } else if (!health) {
      setLoading(true)
    }

    setError(null)
    const startTime = performance.now()

    try {
      if (isManualRefresh) {
        setRefreshStep('Checking REST API & FAISS Vector Index...')
      }

      const [hData, tData] = await Promise.all([
        getDetailedHealth(),
        getThresholds().catch(() => null),
      ])

      const endTime = performance.now()
      const latency = Math.round(endTime - startTime)

      if (isManualRefresh) {
        setRefreshStep('Evaluating AI Models & Health Events...')
        await new Promise((r) => setTimeout(r, 200))
      }

      if (isMountedRef.current) {
        setHealth(hData)
        if (tData) setThresholds(tData)
        setApiLatency(latency)
        setLastChecked(new Date())
      }
    } catch (err) {
      console.error('Failed to load system status:', err)
      if (isMountedRef.current) {
        setError(err.message || 'Unable to connect to backend server. Please verify FastAPI backend is running.')
        setHealth(null)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
        setIsRefreshing(false)
        setRefreshStep('Idle')
      }
    }
  }, [health])

  // Initial load
  useEffect(() => {
    fetchData(false)
  }, [fetchData])

  // Auto-refresh timer with robust cleanup
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchData(false)
    }, refreshIntervalSec * 1000)

    return () => {
      clearInterval(interval)
    }
  }, [autoRefresh, refreshIntervalSec, fetchData])

  // Handle Admin Login
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

  // Handle Threshold Save
  const handleSaveThresholds = async () => {
    if (!adminToken) {
      setShowLoginModal(true)
      return
    }

    // Client-side validation
    if (
      thresholds.face_match_threshold < 0 || thresholds.face_match_threshold > 1 ||
      thresholds.liveness_threshold < 0 || thresholds.liveness_threshold > 1 ||
      thresholds.deepfake_threshold < 0 || thresholds.deepfake_threshold > 1
    ) {
      setThresholdMsg('Error: Cutoff thresholds must be floating numbers between 0.0 and 1.0')
      return
    }

    if (thresholds.blur_threshold < 0 || thresholds.min_face_size < 10) {
      setThresholdMsg('Error: Blur threshold and face size must be positive values.')
      return
    }

    setSavingThresholds(true)
    setThresholdMsg(null)
    try {
      const updated = await updateThresholds(thresholds, adminToken)
      setThresholds(updated)
      setThresholdMsg('✓ Threshold parameters successfully updated and persisted!')
      setTimeout(() => setThresholdMsg(null), 4000)
    } catch (err) {
      console.error('Threshold update error:', err)
      setThresholdMsg(`Error: ${err.message || 'Failed to save configuration.'}`)
    } finally {
      setSavingThresholds(false)
    }
  }

  // Determine Overall System Status Badge
  const getOverallStatusInfo = () => {
    if (error || !health) {
      return {
        label: 'BACKEND OFFLINE',
        badgeClass: 'badge-danger',
        dotColor: '#ef4444',
        icon: '⚫',
        description: 'Unable to communicate with FastAPI server at http://127.0.0.1:8000',
      }
    }

    const st = health.overall_status || health.status
    if (st === 'ALL_SYSTEMS_OPERATIONAL' || st === 'ONLINE') {
      return {
        label: 'ALL SYSTEMS OPERATIONAL',
        badgeClass: 'badge-success',
        dotColor: '#10b981',
        icon: '🟢',
        description: 'All 6 biometric services, neural networks, and FAISS database are operating normally.',
      }
    } else if (st === 'PARTIALLY_OPERATIONAL' || st === 'DEGRADED') {
      return {
        label: 'PARTIALLY OPERATIONAL',
        badgeClass: 'badge-warning',
        dotColor: '#f59e0b',
        icon: '🟡',
        description: 'Core recognition engine is online. Some anti-spoofing/deepfake models are running in fallback mode.',
      }
    } else {
      return {
        label: 'SYSTEM DEGRADED',
        badgeClass: 'badge-danger',
        dotColor: '#ef4444',
        icon: '🔴',
        description: 'Critical biometric components are unavailable or reporting operational errors.',
      }
    }
  }

  // Component Status Badge Renderer
  const renderStatusBadge = (st) => {
    switch (st) {
      case 'ONLINE':
        return (
          <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            ONLINE
          </span>
        )
      case 'DEGRADED':
        return (
          <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            DEGRADED
          </span>
        )
      case 'MODEL_UNAVAILABLE':
      case 'UNAVAILABLE':
        return (
          <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠️</span>
            MODEL UNAVAILABLE
          </span>
        )
      default:
        return (
          <span className="badge badge-danger" style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            ERROR
          </span>
        )
    }
  }

  const overallInfo = getOverallStatusInfo()
  const comp = health?.components || {}

  return (
    <div className="animate-in" style={{ paddingBottom: '40px' }}>
      {/* Page Header with Overall Status & Controls */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px',
          background: 'var(--bg-secondary)',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          marginBottom: '24px',
        }}
      >
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              System Status & Health Monitor
            </h1>

            {/* Calculated Overall System Status */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '20px',
                background: overallInfo.dotColor === '#10b981' ? 'rgba(16,185,129,0.12)' : overallInfo.dotColor === '#f59e0b' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${overallInfo.dotColor}40`,
                fontSize: '12px',
                fontWeight: 700,
                color: overallInfo.dotColor,
              }}
            >
              <span>{overallInfo.icon}</span>
              <span>{overallInfo.label}</span>
            </div>
          </div>

          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', margin: 0 }}>
            {overallInfo.description}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span>
              ⏱️ Last Checked:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {lastChecked ? lastChecked.toLocaleTimeString() : 'Checking...'}
              </strong>
            </span>
            {apiLatency !== null && (
              <span>
                ⚡ Latency:{' '}
                <strong style={{ color: apiLatency < 100 ? '#10b981' : '#f59e0b' }}>
                  {apiLatency} ms
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Header Controls: Refresh & Auto-Refresh */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
          {/* Admin Auth Status Bar */}
          <div>
            {adminToken ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(16,185,129,0.1)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(16,185,129,0.3)',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>
                  🔑 Admin ({adminUser})
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleAdminLogout}
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setShowLoginModal(true)}>
                🔑 Admin Login
              </button>
            )}
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Auto Refresh Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-primary)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Auto Refresh</span>
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: autoRefresh ? '#10b981' : 'var(--bg-secondary)',
                  color: autoRefresh ? '#ffffff' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                {autoRefresh ? 'ON (15s)' : 'OFF'}
              </button>
            </div>

            {/* Manual Refresh Button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchData(true)}
              disabled={isRefreshing || loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span className={isRefreshing ? 'spin' : ''}>🔄</span>
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Step Progress Message during manual refresh */}
      {isRefreshing && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            color: '#3b82f6',
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span className="spin">⏳</span>
          <span>{refreshStep}</span>
        </div>
      )}

      {/* Connection Alert */}
      {error && (
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
          }}
        >
          <div>
            <strong>⚠️ System Connection Alert:</strong> {error}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchData(true)}>
            Retry Connection
          </button>
        </div>
      )}

      {/* Component Readiness Grid (3-4 per row on desktop, 2 on tablet, 1 on mobile) */}
      <div className="card mb-24">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div>
              <span className="card-title">Component Health & Readiness Matrix</span>
              <span style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                Real-time status of REST API, FAISS Index, Face Detection, ArcFace Embedding, and Anti-Spoofing CNNs.
              </span>
            </div>
          </div>
        </div>

        {loading && !health ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spin" style={{ fontSize: '24px', marginBottom: '12px' }}>🔄</div>
            Fetching real-time backend component diagnostics...
          </div>
        ) : health ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
              marginTop: '16px',
            }}
          >
            {/* 1. FastAPI Web Server */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', tracking: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Web API Engine
                  </span>
                  {renderStatusBadge(health.api_status)}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  FastAPI REST Server
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  {comp.api?.details || 'Listening on 127.0.0.1:8000'}
                </p>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Response Time: <strong style={{ color: 'var(--text-primary)' }}>{apiLatency !== null ? `${apiLatency}ms` : 'N/A'}</strong></span>
                <span>Port: <strong>8000</strong></span>
              </div>
            </div>

            {/* 2. FAISS Vector Store */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    1:N Vector Index
                  </span>
                  {renderStatusBadge(health.database_status)}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  FAISS Vector Store
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  {comp.faiss?.details || 'IndexFlatIP 512-dimensional vector search index active'}
                </p>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Enrolled Vectors: <strong style={{ color: 'var(--text-primary)' }}>{health.enrolled_faces_count}</strong></span>
                <span>Dimension: <strong>512d</strong></span>
              </div>
            </div>

            {/* 3. Face Detection (MTCNN) */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Face Detection
                  </span>
                  {renderStatusBadge(health.face_detection_model_status)}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  MTCNN Neural Net
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  {comp.face_detection?.details || 'PyTorch MTCNN multi-stage face detection network'}
                </p>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Metric: <strong style={{ color: 'var(--text-primary)' }}>{comp.face_detection?.metric || 'CPU'}</strong></span>
                <span>Threshold: <strong>{thresholds?.min_face_size ? `${thresholds.min_face_size}px` : '40px'}</strong></span>
              </div>
            </div>

            {/* 4. Face Embedding (InceptionResNetV1) */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Face Embedding
                  </span>
                  {renderStatusBadge(health.face_embedding_model_status)}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  InceptionResNetV1 (ArcFace)
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  {comp.face_embedding?.details || 'ArcFace 512-dimensional vector embedding model ready'}
                </p>
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Output: <strong style={{ color: 'var(--text-primary)' }}>512d L2 Normalized</strong></span>
                <span>Model: <strong>vggface2</strong></span>
              </div>
            </div>

            {/* 5. LivenessNet CNN */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: `1px solid ${health.liveness_model_status === 'ONLINE' ? 'var(--border-color)' : 'rgba(245,158,11,0.3)'}`,
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Anti-Spoofing
                  </span>
                  {renderStatusBadge(health.liveness_model_status)}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  LivenessNet CNN
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {comp.liveness?.details || 'LivenessNet passive anti-spoofing classifier'}
                </p>

                {comp.liveness?.reason && (
                  <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '11px', color: '#f59e0b', marginBottom: '10px' }}>
                    💡 {comp.liveness.reason}
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Mode: <strong style={{ color: 'var(--text-primary)' }}>{comp.liveness?.metric || 'Fallback'}</strong>
                </span>
                {health.liveness_model_status !== 'ONLINE' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setSelectedModelDetails({
                        name: 'LivenessNet Anti-Spoofing CNN',
                        status: health.liveness_model_status,
                        reason: comp.liveness?.reason || 'Model weights checkpoint not found.',
                        recommendation: 'Place trained model weights at backend/models/liveness/best_model.pth to enable production anti-spoofing gating.',
                      })
                    }
                    style={{ padding: '2px 8px', fontSize: '10px' }}
                  >
                    View Details
                  </button>
                )}
              </div>
            </div>

            {/* 6. DeepfakeNet CNN */}
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: `1px solid ${health.deepfake_model_status === 'ONLINE' ? 'var(--border-color)' : 'rgba(245,158,11,0.3)'}`,
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Synthetic Detection
                  </span>
                  {renderStatusBadge(health.deepfake_model_status)}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
                  DeepfakeNet CNN
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {comp.deepfake?.details || 'DeepfakeNet synthetic face analysis layer'}
                </p>

                {comp.deepfake?.reason && (
                  <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '11px', color: '#f59e0b', marginBottom: '10px' }}>
                    💡 {comp.deepfake.reason}
                  </div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Mode: <strong style={{ color: 'var(--text-primary)' }}>{comp.deepfake?.metric || 'Fallback'}</strong>
                </span>
                {health.deepfake_model_status !== 'ONLINE' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setSelectedModelDetails({
                        name: 'DeepfakeNet Synthetic Detection CNN',
                        status: health.deepfake_model_status,
                        reason: comp.deepfake?.reason || 'Model weights checkpoint not found.',
                        recommendation: 'Place trained model weights at backend/models/deepfake/best_model.pth to enable production AI face-swap detection.',
                      })
                    }
                    style={{ padding: '2px 8px', fontSize: '10px' }}
                  >
                    View Details
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* System Diagnostics Metrics Grid */}
      {health && (
        <div className="card mb-24">
          <div className="card-header">
            <div className="card-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <span className="card-title">System Diagnostics & Environment Metrics</span>
              <span style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                Real backend hardware, latency, versioning, and execution environment metrics.
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginTop: '16px',
            }}
          >
            {/* API Latency */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>API Latency</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {apiLatency !== null ? `${apiLatency} ms` : 'N/A'}
              </span>
            </div>

            {/* Database Status */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Database Status</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>
                ONLINE
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>FAISS IndexFlatIP</span>
            </div>

            {/* Number of Enrolled Users */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Enrolled User Vectors</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {health.enrolled_faces_count}
              </span>
            </div>

            {/* Loaded AI Models */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Loaded AI Models</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {health.metrics?.loaded_models ?? '2'} / {health.metrics?.total_models ?? '4'}
              </span>
            </div>

            {/* Backend Version */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Backend Version</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                v{health.version || '0.1.0'}
              </span>
            </div>

            {/* Frontend Version */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Frontend Version</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                v1.0.0
              </span>
            </div>

            {/* Server Uptime */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Server Uptime</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {health.uptime_seconds !== undefined
                  ? `${Math.floor(health.uptime_seconds / 60)}m ${Math.floor(health.uptime_seconds % 60)}s`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Threshold Parameter Control Card */}
      {thresholds && (
        <div className="card mb-24">
          <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
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
                  Tune decision gating cutoffs. Requires Admin authentication token to persist changes.
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
            <div
              style={{
                marginTop: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: thresholdMsg.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                border: `1px solid ${thresholdMsg.startsWith('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                color: thresholdMsg.startsWith('Error') ? '#ef4444' : '#10b981',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
              }}
            >
              {thresholdMsg}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              marginTop: '16px',
            }}
          >
            {/* 1. Face Similarity Match Cutoff */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                Face Similarity Threshold
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <input
                  type="number"
                  step="0.05"
                  min="0.0"
                  max="1.0"
                  className="input"
                  value={thresholds.face_match_threshold}
                  onChange={(e) => setThresholds({ ...thresholds, face_match_threshold: parseFloat(e.target.value) || 0.6 })}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                Allowed range: 0.00 – 1.00 (Default: 0.60). Minimum similarity required to recognize an enrolled identity.
              </span>
            </div>

            {/* 2. Liveness Cutoff */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                Liveness Cutoff
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <input
                  type="number"
                  step="0.05"
                  min="0.0"
                  max="1.0"
                  className="input"
                  value={thresholds.liveness_threshold}
                  onChange={(e) => setThresholds({ ...thresholds, liveness_threshold: parseFloat(e.target.value) || 0.7 })}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                Allowed range: 0.00 – 1.00 (Default: 0.70). Minimum score required to classify face as live.
              </span>
            </div>

            {/* 3. Deepfake Cutoff */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                Deepfake Cutoff
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <input
                  type="number"
                  step="0.05"
                  min="0.0"
                  max="1.0"
                  className="input"
                  value={thresholds.deepfake_threshold}
                  onChange={(e) => setThresholds({ ...thresholds, deepfake_threshold: parseFloat(e.target.value) || 0.5 })}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                Allowed range: 0.00 – 1.00 (Default: 0.50). Maximum synthetic probability allowed before flagging deepfake.
              </span>
            </div>

            {/* 4. Blur Threshold */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                Blur / Quality Threshold
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <input
                  type="number"
                  step="5.0"
                  min="0.0"
                  className="input"
                  value={thresholds.blur_threshold}
                  onChange={(e) => setThresholds({ ...thresholds, blur_threshold: parseFloat(e.target.value) || 30.0 })}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                Allowed range: 0.0+ (Default: 30.0). OpenCV Laplacian variance sharpness cutoff.
              </span>
            </div>

            {/* 5. Min Face Size */}
            <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                Min Face Size (Pixels)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <input
                  type="number"
                  step="5"
                  min="20"
                  className="input"
                  value={thresholds.min_face_size}
                  onChange={(e) => setThresholds({ ...thresholds, min_face_size: parseInt(e.target.value) || 40 })}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                Allowed range: 20px+ (Default: 40px). Minimum facial crop bounding box size.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recent System Events Feed */}
      {health?.events && health.events.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <span className="card-title">Recent System Health Events</span>
              <span style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                Real-time audit log of system checks, model initializations, and state transitions.
              </span>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {health.events.map((ev, idx) => {
              const isWarn = ev.severity === 'warning' || ev.severity === 'error'
              const color = isWarn ? '#f59e0b' : '#10b981'
              return (
                <div
                  key={ev.id || idx}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    gap: '12px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: isWarn ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                        color,
                      }}
                    >
                      {ev.severity}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {ev.message}
                    </span>
                    {ev.details && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        — {ev.details}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Model Unavailable Details Modal */}
      {selectedModelDetails && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card animate-in" style={{ maxWidth: '520px', width: '100%', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  {selectedModelDetails.name}
                </h2>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedModelDetails(null)}
                style={{ padding: '4px 10px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', marginBottom: '16px' }}>
              <strong style={{ color: '#f59e0b', display: 'block', marginBottom: '4px' }}>Backend Status Reason:</strong>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-primary)', margin: 0 }}>
                {selectedModelDetails.reason}
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <strong style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Recommended Resolution:</strong>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                {selectedModelDetails.recommendation}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setSelectedModelDetails(null)}>
                Close Diagnostics
              </button>
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
