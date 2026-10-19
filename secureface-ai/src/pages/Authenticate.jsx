import { useState, useRef, useEffect, useCallback } from 'react'
import { recognizeFace, getVerificationHistory, clearVerificationHistory } from '../services/api'
import Breadcrumb from '../components/Breadcrumb'

function Authenticate() {
  const [inputMode, setInputMode] = useState('camera') // 'camera' | 'upload'
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [captured, setCaptured] = useState(false)
  const [lightingStatus, setLightingStatus] = useState({
    tone: 'neutral',
    message: 'Checking lighting...',
  })

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)

  const [historyLogs, setHistoryLogs] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const lightingCanvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await getVerificationHistory(10)
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

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

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
      setCameraError('Camera access unavailable. Please grant browser permissions or use image upload.')
      setCameraActive(false)
    }
  }

  useEffect(() => {
    if (inputMode === 'camera') {
      startCamera()
    }
    return () => {
      stopCamera()
    }
  }, [inputMode, stopCamera])

  useEffect(() => {
    if (!cameraActive || captured) return

    const video = videoRef.current
    const canvas = lightingCanvasRef.current
    if (!video || !canvas) return

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return

    const intervalId = window.setInterval(() => {
      if (video.readyState < 2 || !video.videoWidth) return

      canvas.width = 32
      canvas.height = 24
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      let totalBrightness = 0
      let pixels

      try {
        pixels = context.getImageData(0, 0, canvas.width, canvas.height).data

        for (let i = 0; i < pixels.length; i += 4) {
          totalBrightness +=
            0.2126 * pixels[i] +
            0.7152 * pixels[i + 1] +
            0.0722 * pixels[i + 2]
        }
      } catch (err) {
        console.warn('Could not sample camera lighting:', err)
        return
      }

      const averageBrightness = totalBrightness / (pixels.length / 4)

      if (averageBrightness < 65) {
        setLightingStatus({
          tone: 'warning',
          message: 'Low lighting — move to a brighter area',
        })
      } else if (averageBrightness > 210) {
        setLightingStatus({
          tone: 'warning',
          message: 'Excessive brightness — avoid strong light',
        })
      } else {
        setLightingStatus({
          tone: 'good',
          message: 'Lighting looks suitable',
        })
      }
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [cameraActive, captured])

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

  const handleRetake = () => {
    setCaptured(false)
    setSelectedFile(null)
    setPreviewUrl(null)
    setResult(null)
    setError(null)
    startCamera()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']
      if (!validTypes.includes(file.type)) {
        setError('Unsupported image format. Please upload JPEG, PNG, or WebP.')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds the 10 MB limit.')
        return
      }

      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResult(null)
      setError(null)
    }
  }

  const handleVerify = async () => {
    if (!selectedFile) {
      setError('Please capture a face frame or upload an image file first.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const data = await recognizeFace(formData)
      setResult(data)
      fetchHistory()
    } catch (err) {
      setError(err.message || 'Verification failed. Verify backend server is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all verification history records?')) return
    try {
      await clearVerificationHistory()
      setHistoryLogs([])
    } catch (err) {
      console.error('Failed to clear history:', err)
    }
  }

  const getDecisionTheme = (decision) => {
    switch (decision) {
      case 'AUTHENTICATED':
      case 'VERIFIED':
        return {
          bannerClass: 'decision-banner-verified',
          badgeText: 'AUTHENTICATED',
          badgeClass: 'badge-success',
          headline: 'Biometric Identity Verified',
        }
      case 'DEEPFAKE_SUSPECTED':
        return {
          bannerClass: 'decision-banner-deepfake',
          badgeText: 'DEEPFAKE DETECTED',
          badgeClass: 'badge-purple',
          headline: 'Synthetic Face Manipulation Blocked',
        }
      case 'LIVENESS_FAILED':
        return {
          bannerClass: 'decision-banner-spoof',
          badgeText: 'SPOOF DETECTED',
          badgeClass: 'badge-danger',
          headline: 'Presentation Attack Intercepted',
        }
      case 'UNKNOWN_PERSON':
        return {
          bannerClass: 'decision-banner-unknown',
          badgeText: 'UNRECOGNIZED',
          badgeClass: 'badge-warning',
          headline: 'Identity Below Match Threshold',
        }
      case 'POOR_QUALITY':
        return {
          bannerClass: 'decision-banner-warning',
          badgeText: 'POOR QUALITY',
          badgeClass: 'badge-warning',
          headline: 'Image Quality Assessment Failed',
        }
      case 'NO_FACE':
        return {
          bannerClass: 'decision-banner-warning',
          badgeText: 'NO FACE FOUND',
          badgeClass: 'badge-neutral',
          headline: 'Zero Faces Detected in Image',
        }
      case 'MULTIPLE_FACES':
        return {
          bannerClass: 'decision-banner-warning',
          badgeText: 'MULTIPLE FACES',
          badgeClass: 'badge-warning',
          headline: 'Multiple Faces Detected (Single Face Required)',
        }
      default:
        return {
          bannerClass: 'decision-banner-rejected',
          badgeText: decision || 'REJECTED',
          badgeClass: 'badge-danger',
          headline: 'Authentication Rejected',
        }
    }
  }

  const decisionTheme = result ? getDecisionTheme(result.final_decision) : null

  return (
    <div className="authenticate-container animate-in">
      <Breadcrumb items={[{ label: 'Verify Identity' }]} />

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Live Biometric Face Verification</h1>
          <p className="page-subtitle">
            Autonomous multi-layer pipeline: MTCNN Localization → Passive Anti-Spoofing → ArcFace 512d Embedding → FAISS 1:N Matching.
          </p>
        </div>
      </div>

      <div className="auth-two-column-layout mb-24">
        {/* Left Column: Input Stream / Upload & Trigger */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-title-group">
              <h3 className="card-title">Verification Input Source</h3>
              <p className="card-subtitle">Select live camera capture or high-resolution photo file</p>
            </div>

            <div className="tab-pill-group">
              <button
                type="button"
                className={`tab-pill-btn ${inputMode === 'camera' ? 'active' : ''}`}
                onClick={() => handleModeChange('camera')}
                id="mode-camera-btn"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mini-icon">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Live Camera
              </button>
              <button
                type="button"
                className={`tab-pill-btn ${inputMode === 'upload' ? 'active' : ''}`}
                onClick={() => handleModeChange('upload')}
                id="mode-upload-btn"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mini-icon">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload Photo
              </button>
            </div>
          </div>

          {/* Camera View */}
          {inputMode === 'camera' && (
            <div className="camera-view-container">
              {!captured ? (
                <div className="video-viewport">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={(e) => e.currentTarget.play().catch(console.error)}
                    className="live-video-element"
                  />
                  {cameraActive && (
                    <div className="camera-guideline-overlay">
                      <div className="face-oval-guide" />
                      <span className="guideline-hint">Position face within frame</span>
                    </div>
                  )}

                  {cameraActive && !captured && (
                    <div
                      className={`lighting-status lighting-status-${lightingStatus.tone}`}
                      role="status"
                      aria-live="polite"
                    >
                      <span className="lighting-status-dot" />
                      {lightingStatus.message}
                    </div>
                  )}

                  {cameraError && (
                    <div className="camera-error-message">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <p>{cameraError}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="preview-viewport">
                  <img src={previewUrl} alt="Captured frame" className="preview-image-element" />
                  <div className="captured-badge-overlay">
                    <span className="status-badge badge-success">Frame Captured</span>
                  </div>
                </div>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <canvas ref={lightingCanvasRef} style={{ display: 'none' }} />

              <div className="camera-controls-row">
                {!captured ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={capturePhoto}
                    disabled={!cameraActive}
                    id="capture-photo-btn"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Capture Face Frame
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleRetake}
                    id="retake-photo-btn"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                      <path d="M1 4v6h6" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    Retake Photo
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Upload View */}
          {inputMode === 'upload' && (
            <div className="upload-view-container">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="face-file-upload-input"
              />

              {!previewUrl ? (
                <div
                  className="upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="dropzone-icon">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <h4>Click or Drag to Upload Query Photo</h4>
                  <p>Supports JPEG, PNG, WebP up to 10 MB with exactly 1 visible face</p>
                </div>
              ) : (
                <div className="preview-viewport">
                  <img src={previewUrl} alt="Upload preview" className="preview-image-element" />
                  <div className="upload-preview-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change Photo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="alert-banner alert-danger mt-16">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Main Action Button */}
          <div className="mt-20">
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={handleVerify}
              disabled={loading || !selectedFile}
              id="execute-verify-btn"
            >
              {loading ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon spin">
                    <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                    <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
                  </svg>
                  Processing Neural Biometrics...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  Execute Biometric Verification
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Pipeline Result Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-title-group">
              <h3 className="card-title">Verification Outcome</h3>
              <p className="card-subtitle">Real-time decisions, match scores, and telemetry</p>
            </div>
            {result && (
              <span className={`status-badge ${decisionTheme.badgeClass}`}>
                {decisionTheme.badgeText}
              </span>
            )}
          </div>

          {!result && !loading && (
            <div className="empty-state-box">
              <div className="empty-state-icon-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <h4 className="empty-state-title">Awaiting Verification Query</h4>
              <p className="empty-state-text">
                Capture a live frame or upload a photo to evaluate detection, liveness, deepfake synthetic analysis, and 1:N FAISS identity search.
              </p>
            </div>
          )}

          {loading && (
            <div className="empty-state-box">
              <div className="spin mb-12">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin-icon-lg">
                  <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                  <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
                </svg>
              </div>
              <h4 className="empty-state-title">Evaluating Multi-Stage Pipeline</h4>
              <p className="empty-state-text">
                MTCNN face cropping → Laplacian blur variance → LivenessNet anti-spoofing → ArcFace 512d extraction → FAISS cosine search.
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="verification-results-container">
              {/* Decision Hero Banner */}
              <div className={`decision-hero-banner ${decisionTheme.bannerClass}`}>
                <div className="decision-banner-header">
                  <span className={`status-badge ${decisionTheme.badgeClass}`}>
                    {decisionTheme.badgeText}
                  </span>
                  <span className="decision-latency">
                    {result.total_processing_time || result.timing_ms?.total_ms || 0} ms
                  </span>
                </div>
                <h3 className="decision-banner-headline">{decisionTheme.headline}</h3>
                <p className="decision-banner-explanation">{result.explanation}</p>
              </div>

              {/* Matched Identity Profile */}
              <div className="result-metric-grid mt-16">
                <div className="result-metric-box">
                  <span className="result-metric-label">IDENTIFIED USER</span>
                  <span className="result-metric-value">
                    {result.matched_user?.name || result.identity || 'Unrecognized'}
                  </span>
                  <span className="result-metric-sub">
                    {result.matched_user?.user_id ? `ID: ${result.matched_user.user_id}` : 'No vector match'}
                  </span>
                </div>

                <div className="result-metric-box">
                  <span className="result-metric-label">SIMILARITY SCORE</span>
                  <span className="result-metric-value">
                    {((result.similarity_score || result.best_similarity || 0) * 100).toFixed(1)}%
                  </span>
                  <span className="result-metric-sub">
                    Threshold: {((result.threshold || 0.6) * 100).toFixed(0)}% Cosine
                  </span>
                </div>

                <div className="result-metric-box">
                  <span className="result-metric-label">LIVENESS SCORE</span>
                  <span className={`result-metric-value ${result.liveness_status === 'SPOOF' ? 'danger-text' : 'success-text'}`}>
                    {((result.liveness_score || 0) * 100).toFixed(1)}%
                  </span>
                  <span className="result-metric-sub">
                    Status: {result.liveness_status || (result.is_live ? 'REAL' : 'SPOOF')}
                  </span>
                </div>

                <div className="result-metric-box">
                  <span className="result-metric-label">DEEPFAKE PROBABILITY</span>
                  <span className={`result-metric-value ${result.deepfake_status === 'DEEPFAKE' ? 'purple-text' : 'success-text'}`}>
                    {((result.deepfake_probability || 0) * 100).toFixed(1)}%
                  </span>
                  <span className="result-metric-sub">
                    Status: {result.deepfake_status || (result.is_deepfake ? 'SYNTHETIC' : 'REAL')}
                  </span>
                </div>
              </div>

              {/* Timing Breakdown Bar */}
              {result.timing_ms && (
                <div className="pipeline-timing-card mt-16">
                  <div className="timing-card-title">Pipeline Stage Execution Timing</div>
                  <div className="timing-pills-row">
                    <span className="timing-pill">Detection: <strong>{result.timing_ms.detection_ms || 0}ms</strong></span>
                    <span className="timing-pill">Quality: <strong>{result.timing_ms.quality_ms || 0}ms</strong></span>
                    <span className="timing-pill">Liveness: <strong>{result.timing_ms.liveness_ms || 0}ms</strong></span>
                    <span className="timing-pill">Embedding: <strong>{result.timing_ms.embedding_ms || 0}ms</strong></span>
                    <span className="timing-pill">FAISS Search: <strong>{result.timing_ms.search_ms || 0}ms</strong></span>
                    <span className="timing-pill highlight">Total: <strong>{result.timing_ms.total_ms || 0}ms</strong></span>
                  </div>
                </div>
              )}

              {/* Top Candidate Matches if available */}
              {result.top_candidates && result.top_candidates.length > 0 && (
                <div className="candidates-list-card mt-16">
                  <div className="candidates-header">FAISS 1:N Candidate Ranking</div>
                  <div className="candidates-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Candidate Name</th>
                          <th>User ID</th>
                          <th>Cosine Similarity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.top_candidates.map((cand, idx) => (
                          <tr key={cand.user_id || idx}>
                            <td>#{idx + 1}</td>
                            <td><strong>{cand.name}</strong></td>
                            <td className="monospace-text">{cand.user_id}</td>
                            <td className="metric-cell">{((cand.score || 0) * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Verification History Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-title-group">
            <h3 className="card-title">Session Verification History</h3>
            <p className="card-subtitle">Real-time audit records stored during verification attempts</p>
          </div>
          <div className="header-actions-group">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchHistory}
              disabled={historyLoading}
            >
              Refresh
            </button>
            {historyLogs.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm danger-text"
                onClick={handleClearHistory}
              >
                Clear History
              </button>
            )}
          </div>
        </div>

        {historyLoading && historyLogs.length === 0 ? (
          <div className="empty-state-box">
            <p>Loading audit records...</p>
          </div>
        ) : historyLogs.length === 0 ? (
          <div className="empty-state-box">
            <p className="empty-state-text">No verification records stored in audit history yet.</p>
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
                  <th>Liveness Score</th>
                  <th>Deepfake Prob</th>
                  <th>Total Latency</th>
                </tr>
              </thead>
              <tbody>
                {historyLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="timestamp-cell">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}
                    </td>
                    <td className="identity-cell">
                      <strong>{log.identity || 'Unauthenticated'}</strong>
                      {log.user_id && <span className="user-id-sub">ID: {log.user_id}</span>}
                    </td>
                    <td>
                      <span className={`status-badge ${getDecisionTheme(log.final_decision).badgeClass}`}>
                        {getDecisionTheme(log.final_decision).badgeText}
                      </span>
                    </td>
                    <td className="metric-cell">
                      {((log.similarity_score || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="metric-cell">
                      {((log.liveness_score || 0) * 100).toFixed(1)}% ({log.liveness_status || 'REAL'})
                    </td>
                    <td className="metric-cell">
                      {((log.deepfake_probability || 0) * 100).toFixed(1)}%
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
    </div>
  )
}

export default Authenticate
