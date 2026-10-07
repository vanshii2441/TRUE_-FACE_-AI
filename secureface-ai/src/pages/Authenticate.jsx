import { useState, useRef, useEffect, useCallback } from 'react'
import { recognizeFace, getVerificationHistory, clearVerificationHistory } from '../services/api'

// 7 Verification Pipeline Stages required by specification
const STAGES = [
  { id: 1, label: 'Detecting Face', desc: 'MTCNN face detection & alignment' },
  { id: 2, label: 'Checking Face Quality', desc: 'Blur variance & dimension evaluation' },
  { id: 3, label: 'Checking Liveness', desc: 'Passive CNN anti-spoofing analysis' },
  { id: 4, label: 'Checking Deepfake', desc: 'Synthetic AI manipulation detection' },
  { id: 5, label: 'Generating Embedding', desc: '512d ArcFace vector generation' },
  { id: 6, label: 'Searching Identity', desc: 'FAISS 1:N vector index lookup' },
  { id: 7, label: 'Final Verification', desc: 'Centralized decision engine' },
]

function Authenticate() {
  const [inputMode, setInputMode] = useState('camera') // 'camera' | 'upload'
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeStage, setActiveStage] = useState(0) // 1 to 7 during execution
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Camera states
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [captured, setCaptured] = useState(false)

  // History state
  const [historyLogs, setHistoryLogs] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await getVerificationHistory(20)
      setHistoryLogs(data.history || [])
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  // Start camera stream
  const startCamera = async () => {
    setCameraError(null)
    setError(null)
    setResult(null)
    setCaptured(false)
    setSelectedFile(null)
    setPreviewUrl(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch (err) {
      console.error('Camera initialization failed:', err)
      setCameraError('Camera access denied or unavailable. Please grant permission or use image upload.')
      setCameraActive(false)
    }
  }

  // Cleanup camera stream on component unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Handle mode switching
  const handleModeChange = (mode) => {
    setInputMode(mode)
    setError(null)
    setResult(null)
    setCaptured(false)
    setSelectedFile(null)
    setPreviewUrl(null)

    if (mode === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }
  }

  // Capture frame from webcam
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `live_capture_${Date.now()}.jpg`, { type: 'image/jpeg' })
        setSelectedFile(file)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setCaptured(true)
        stopCamera()
      }
    }, 'image/jpeg', 0.95)
  }

  // Retake photo
  const handleRetake = () => {
    setCaptured(false)
    setSelectedFile(null)
    setPreviewUrl(null)
    setResult(null)
    setError(null)
    startCamera()
  }

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResult(null)
      setError(null)
    }
  }

  // Execute end-to-end verification request
  const handleVerify = async () => {
    if (!selectedFile) {
      setError('Please capture a photo or upload an image for verification.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setActiveStage(1)

    // Stage progress transitions
    const t1 = setTimeout(() => setActiveStage(2), 150)
    const t2 = setTimeout(() => setActiveStage(3), 300)
    const t3 = setTimeout(() => setActiveStage(4), 450)
    const t4 = setTimeout(() => setActiveStage(5), 600)
    const t5 = setTimeout(() => setActiveStage(6), 750)
    const t6 = setTimeout(() => setActiveStage(7), 900)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const data = await recognizeFace(formData)

      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
      clearTimeout(t6)

      setActiveStage(7)
      setResult(data)
      fetchHistory()
    } catch (err) {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
      clearTimeout(t6)
      setError(err.message || 'Verification request failed. Please check backend connection.')
    } finally {
      setLoading(false)
    }
  }

  // Clear history action
  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear verification history?')) return
    try {
      await clearVerificationHistory()
      setHistoryLogs([])
    } catch (err) {
      console.error('Failed to clear history:', err)
    }
  }

  // Determine status configuration for UI badges and cards
  const getResultStatus = (res) => {
    if (!res) return null
    const decision = res.final_decision || res.status

    switch (decision) {
      case 'AUTHENTICATED':
      case 'VERIFIED':
        return {
          title: 'VERIFIED',
          badgeText: '✅ VERIFIED',
          color: '#10b981',
          bgColor: 'rgba(16, 185, 129, 0.08)',
          borderColor: '#10b981',
          icon: '✅',
          statusClass: 'verified',
        }
      case 'DEEPFAKE_SUSPECTED':
        return {
          title: 'SUSPICIOUS (DEEPFAKE)',
          badgeText: '⚠️ SUSPICIOUS',
          color: '#8b5cf6',
          bgColor: 'rgba(139, 92, 246, 0.08)',
          borderColor: '#8b5cf6',
          icon: '⚠️',
          statusClass: 'suspicious',
        }
      case 'UNKNOWN_PERSON':
      case 'EMPTY_DATABASE':
        return {
          title: 'UNKNOWN USER',
          badgeText: '❓ UNKNOWN USER',
          color: '#f59e0b',
          bgColor: 'rgba(245, 158, 11, 0.08)',
          borderColor: '#f59e0b',
          icon: '❓',
          statusClass: 'unknown',
        }
      default:
        return {
          title: 'VERIFICATION FAILED',
          badgeText: '❌ VERIFICATION FAILED',
          color: '#ef4444',
          bgColor: 'rgba(239, 68, 68, 0.08)',
          borderColor: '#ef4444',
          icon: '❌',
          statusClass: 'failed',
        }
    }
  }

  const statusConfig = getResultStatus(result)

  return (
    <div className="animate-in" style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div className="page-header">
        <h1>Live Face Verification</h1>
        <p>
          Real-time multi-stage biometric authentication: Camera Capture → Detection → Quality → Passive Liveness → Deepfake Authenticity → ArcFace 512d Embedding → FAISS Identity Search.
        </p>
      </div>

      {/* Main Verification Card */}
      <div className="card mb-24" style={{ maxWidth: '840px', margin: '0 auto 24px auto' }}>
        <div className="card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <span className="card-title">Live Verification Interface</span>
          </div>

          {/* Mode Selector */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
            <button
              className={`btn btn-sm ${inputMode === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleModeChange('camera')}
              id="mode-camera-btn"
            >
              📹 Live Camera
            </button>
            <button
              className={`btn btn-sm ${inputMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleModeChange('upload')}
              id="mode-upload-btn"
            >
              📁 Upload Image
            </button>
          </div>
        </div>

        {/* Input Area: Camera */}
        {inputMode === 'camera' && (
          <div style={{ textAlign: 'center' }}>
            {!captured ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxHeight: '380px',
                  background: '#0a0f1d',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-color)',
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    maxHeight: '380px',
                    objectFit: 'cover',
                    display: cameraActive ? 'block' : 'none',
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {!cameraActive && (
                  <div style={{ padding: '48px 24px', color: 'var(--text-muted)' }}>
                    {cameraError ? (
                      <div>
                        <p style={{ color: '#ef4444', fontWeight: 600, marginBottom: '12px' }}>⚠️ {cameraError}</p>
                        <button className="btn btn-secondary btn-sm" onClick={startCamera}>
                          Retry Camera Permission
                        </button>
                      </div>
                    ) : (
                      <p>Initializing live camera stream...</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                <p style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  CAPTURED FRAME READY FOR VERIFICATION:
                </p>
                <img
                  src={previewUrl}
                  alt="Captured Frame"
                  style={{ maxHeight: '280px', borderRadius: '8px', border: '2px solid var(--primary)' }}
                />
              </div>
            )}

            {/* Camera Action Buttons */}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {!cameraActive && !captured && (
                <button className="btn btn-primary" onClick={startCamera} id="start-camera-btn">
                  ▶ Start Camera
                </button>
              )}

              {cameraActive && !captured && (
                <>
                  <button className="btn btn-primary" onClick={capturePhoto} id="capture-photo-btn">
                    📸 Capture / Verify Frame
                  </button>
                  <button className="btn btn-secondary" onClick={stopCamera} id="stop-camera-btn">
                    ⏹ Stop Camera
                  </button>
                </>
              )}

              {captured && (
                <button className="btn btn-secondary" onClick={handleRetake} id="retake-photo-btn">
                  🔄 Retake Photo
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input Area: Upload */}
        {inputMode === 'upload' && (
          <div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="verification-file-input"
            />

            <div
              className="auth-preview"
              style={{
                cursor: 'pointer',
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '32px 24px',
                textAlign: 'center',
                background: 'var(--bg-secondary)',
                transition: 'all 0.2s ease',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div>
                  <img
                    src={previewUrl}
                    alt="Selected Face"
                    style={{
                      maxHeight: '260px',
                      borderRadius: '8px',
                      objectFit: 'contain',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                  <p style={{ marginTop: '10px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                    Click to choose a different image ({selectedFile?.name})
                  </p>
                </div>
              ) : (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.7, color: 'var(--primary)', margin: '0 auto 12px auto' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Select Face Image File</p>
                  <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Supports JPEG, PNG, WebP or BMP formats
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleVerify}
            disabled={!selectedFile || loading}
            style={{ width: '100%', maxWidth: '380px' }}
            id="run-verification-btn"
          >
            {loading ? 'Evaluating Pipeline...' : '🔍 Execute Verification'}
          </button>
        </div>

        {/* Stage Progress Indicator */}
        {loading && (
          <div style={{ marginTop: '24px', padding: '18px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', marginBottom: '14px', letterSpacing: '0.05em' }}>
              REAL-TIME PIPELINE PROGRESS
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
              {STAGES.map((stg) => {
                const isActive = stg.id === activeStage
                const isDone = stg.id < activeStage
                return (
                  <div
                    key={stg.id}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      background: isActive
                        ? 'rgba(37,99,235,0.15)'
                        : isDone
                        ? 'rgba(16,185,129,0.1)'
                        : 'var(--bg-card)',
                      border: isActive
                        ? '1px solid var(--primary)'
                        : isDone
                        ? '1px solid #10b981'
                        : '1px solid var(--border-color)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, color: isActive ? 'var(--primary)' : isDone ? '#10b981' : 'var(--text-muted)' }}>
                      {isDone ? '✓ ' : ''}{stg.id}. {stg.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* User-Friendly Error Display */}
        {error && (
          <div className="mt-16" style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', fontSize: 'var(--font-sm)' }}>
            ⚠️ <strong>Verification Notice:</strong> {error}
          </div>
        )}
      </div>

      {/* Verification Result Card */}
      {result && statusConfig && (
        <div className="result-section animate-in" id="verification-result-panel" style={{ maxWidth: '840px', margin: '0 auto 32px auto' }}>
          <div
            className="card"
            style={{
              borderLeft: `6px solid ${statusConfig.borderColor}`,
              background: statusConfig.bgColor,
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }}
          >
            {/* Decision Status Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>{statusConfig.icon}</span>
                <div>
                  <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: statusConfig.color, margin: 0 }}>
                    {statusConfig.badgeText}
                  </h2>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                    Decision: {result.final_decision}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Pipeline Latency</span>
                <span style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--primary)' }}>
                  {result.total_processing_time ?? result.timing_ms?.total_ms ?? 0} ms
                </span>
              </div>
            </div>

            {/* Explanation text */}
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                marginBottom: '18px',
              }}
            >
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                Decision Explanation
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: 'var(--font-sm)', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
                {result.explanation}
              </p>
              {result.reasons && result.reasons.length > 0 && (
                <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  {result.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Detailed Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                background: 'var(--bg-card)',
                padding: '18px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
              }}
            >
              {/* Identity Details */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Recognized User</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                  {result.identity || result.matched_user?.name || 'Unauthenticated'}
                </p>
                {result.matched_user?.user_id && (
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>ID: {result.matched_user.user_id}</span>
                )}
              </div>

              {/* Match Similarity Score */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Face Similarity Match</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: result.is_authenticated ? '#10b981' : '#f59e0b', margin: '2px 0 0 0' }}>
                  {((result.similarity_score ?? result.best_similarity ?? 0) * 100).toFixed(2)}%
                </p>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Cutoff: {((result.threshold || 0.6) * 100).toFixed(0)}%</span>
              </div>

              {/* Liveness Score */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Liveness Anti-Spoofing</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: result.is_live ? '#10b981' : '#ef4444', margin: '2px 0 0 0' }}>
                  {((result.liveness_score ?? 0) * 100).toFixed(1)}% ({result.is_live ? 'REAL' : 'SPOOF'})
                </p>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Status: {result.liveness_status || 'REAL'}</span>
              </div>

              {/* Deepfake Probability */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Deepfake Synthetic Prob</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: result.is_deepfake ? '#8b5cf6' : '#10b981', margin: '2px 0 0 0' }}>
                  {((result.deepfake_probability ?? 0) * 100).toFixed(1)}% ({result.is_deepfake ? 'SYNTHETIC' : 'AUTHENTIC'})
                </p>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Status: {result.deepfake_status || 'REAL'}</span>
              </div>

              {/* Face Quality */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Face Quality & Sharpness</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: result.is_quality_passed !== false ? '#10b981' : '#ea580c', margin: '2px 0 0 0' }}>
                  {((result.quality_score ?? 1) * 100).toFixed(0)}% (Blur: {result.blur_score ?? 'N/A'})
                </p>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  Quality: {result.is_quality_passed !== false ? 'PASSED' : 'LOW QUALITY'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification Audit History Section */}
      <div className="card" style={{ maxWidth: '840px', margin: '0 auto' }} id="verification-history-card">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card-icon info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="card-title">Recent Verification History</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchHistory} disabled={historyLoading}>
              🔄 Refresh Log
            </button>
            {historyLogs.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={handleClearHistory} style={{ color: '#ef4444' }}>
                🗑 Clear History
              </button>
            )}
          </div>
        </div>

        {historyLogs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', textAlign: 'center', padding: '24px' }}>
            No verification history logs recorded yet. Execute a verification above to populate the audit store.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Decision</th>
                  <th>Identity</th>
                  <th>Similarity</th>
                  <th>Liveness</th>
                  <th>Deepfake</th>
                </tr>
              </thead>
              <tbody>
                {historyLogs.map((log) => {
                  const isAuth = log.is_authenticated
                  const isDf = log.deepfake_status === 'DEEPFAKE' || log.deepfake_probability >= 0.5
                  const isSpoof = log.liveness_status === 'SPOOF'

                  let badgeStyle = { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }
                  if (isAuth) badgeStyle = { background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }
                  else if (isDf) badgeStyle = { background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }
                  else if (log.final_decision === 'UNKNOWN_PERSON') badgeStyle = { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }

                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge" style={{ ...badgeStyle, padding: '4px 8px', fontSize: '11px', fontWeight: 700 }}>
                          {log.final_decision}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.identity || 'Unauthenticated'}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {(log.similarity_score * 100).toFixed(1)}%
                      </td>
                      <td style={{ color: isSpoof ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                        {(log.liveness_score * 100).toFixed(1)}% ({log.liveness_status || 'REAL'})
                      </td>
                      <td style={{ color: isDf ? '#8b5cf6' : '#10b981', fontWeight: 600 }}>
                        {(log.deepfake_probability * 100).toFixed(1)}% ({log.deepfake_status || 'REAL'})
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Authenticate
