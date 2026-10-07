import { useState, useRef, useEffect } from 'react'
import { recognizeFace } from '../services/api'

function Authenticate() {
  const [inputMode, setInputMode] = useState('upload') // 'upload' | 'camera'
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Camera state
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)

  const steps = [
    { label: 'Detecting Face', desc: 'MTCNN Bounding Box Localization' },
    { label: 'Quality & Liveness Check', desc: 'Blur & Passive Anti-Spoofing' },
    { label: 'Deepfake Check', desc: 'DeepfakeNet Neural Analysis' },
    { label: 'Identifying Person', desc: 'FAISS 512d Vector Search' },
  ]

  // Stop camera stream when component unmounts or mode switches
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const startCamera = async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch (err) {
      console.error('Camera access error:', err)
      setCameraError('Unable to access webcam. Please check permissions or upload an image file.')
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const handleModeChange = (mode) => {
    setInputMode(mode)
    setError(null)
    setResult(null)
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
        const file = new File([blob], `webcam_snapshot_${Date.now()}.jpg`, { type: 'image/jpeg' })
        setSelectedFile(file)
        setPreviewUrl(URL.createObjectURL(blob))
        setResult(null)
        setError(null)
      }
    }, 'image/jpeg', 0.95)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResult(null)
      setError(null)
    }
  }

  const handleAuthenticate = async () => {
    if (!selectedFile) {
      setError('Please select or capture a face image first.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setActiveStep(0)

    // Simulate multi-stage visual progression
    const timer1 = setTimeout(() => setActiveStep(1), 250)
    const timer2 = setTimeout(() => setActiveStep(2), 550)
    const timer3 = setTimeout(() => setActiveStep(3), 850)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const data = await recognizeFace(formData)

      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)

      setResult(data)
    } catch (err) {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      setError(err.message || 'Authentication request failed.')
    } finally {
      setLoading(false)
    }
  }

  const decision = result?.final_decision || result?.status

  // Helper for UI status configuration
  const getStatusConfig = (dec) => {
    switch (dec) {
      case 'AUTHENTICATED':
      case 'MATCH':
      case 'VERIFIED':
        return {
          title: 'VERIFIED IDENTITY',
          badgeClass: 'badge-success',
          color: '#10b981',
          bg: 'rgba(16,185,129,0.08)',
          border: '#10b981',
          icon: '✓',
        }
      case 'LIVENESS_FAILED':
      case 'SPOOF_DETECTED':
        return {
          title: 'VERIFICATION FAILED — SPOOF DETECTED',
          badgeClass: 'badge-danger',
          color: '#ef4444',
          bg: 'rgba(239,68,68,0.08)',
          border: '#ef4444',
          icon: '🚫',
        }
      case 'DEEPFAKE_SUSPECTED':
        return {
          title: 'SUSPICIOUS — DEEPFAKE DETECTED',
          badgeClass: 'badge-purple',
          color: '#8b5cf6',
          bg: 'rgba(139,92,246,0.1)',
          border: '#8b5cf6',
          icon: '🤖',
        }
      case 'POOR_QUALITY':
      case 'BLURRY_IMAGE':
        return {
          title: 'VERIFICATION FAILED — POOR QUALITY',
          badgeClass: 'badge-warning',
          color: '#f97316',
          bg: 'rgba(249,115,22,0.08)',
          border: '#f97316',
          icon: '📷',
        }
      case 'UNKNOWN_PERSON':
      case 'NO_MATCH':
        return {
          title: 'VERIFICATION FAILED — UNKNOWN PERSON',
          badgeClass: 'badge-warning',
          color: '#f59e0b',
          bg: 'rgba(245,158,11,0.08)',
          border: '#f59e0b',
          icon: '❓',
        }
      case 'NO_FACE':
        return {
          title: 'NO FACE DETECTED',
          badgeClass: 'badge-secondary',
          color: '#eab308',
          bg: 'rgba(234,179,8,0.08)',
          border: '#eab308',
          icon: '🔍',
        }
      case 'MULTIPLE_FACES':
        return {
          title: 'MULTIPLE FACES DETECTED',
          badgeClass: 'badge-warning',
          color: '#f97316',
          bg: 'rgba(249,115,22,0.08)',
          border: '#f97316',
          icon: '👥',
        }
      case 'EMPTY_DATABASE':
        return {
          title: 'EMPTY FACE DATABASE',
          badgeClass: 'badge-info',
          color: '#3b82f6',
          bg: 'rgba(59,130,246,0.08)',
          border: '#3b82f6',
          icon: 'ℹ️',
        }
      default:
        return {
          title: 'SYSTEM ERROR',
          badgeClass: 'badge-danger',
          color: '#ef4444',
          bg: 'rgba(239,68,68,0.08)',
          border: '#ef4444',
          icon: '💥',
        }
    }
  }

  const statusConfig = result ? getStatusConfig(decision) : null

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Live Face Verification & Authentication</h1>
        <p>
          Multi-Stage Deep Learning Pipeline: Face Detection → Quality Check → Passive Liveness → Deepfake Detection → ArcFace 512d Embedding → FAISS 1:N Search.
        </p>
      </div>

      {/* Mode Selector & Input Container */}
      <div className="card mb-24" style={{ maxWidth: '720px', margin: '0 auto 24px auto' }}>
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <span className="card-title">Biometric Verification Input</span>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
            <button
              className={`btn btn-sm ${inputMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleModeChange('upload')}
              style={{ padding: '6px 14px', fontSize: 'var(--font-xs)' }}
            >
              Upload Image
            </button>
            <button
              className={`btn btn-sm ${inputMode === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handleModeChange('camera')}
              style={{ padding: '6px 14px', fontSize: 'var(--font-xs)' }}
            >
              Live Camera
            </button>
          </div>
        </div>

        {/* Input Mode: File Upload */}
        {inputMode === 'upload' && (
          <div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div
              className="auth-preview"
              style={{
                cursor: 'pointer',
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                background: 'var(--bg-secondary)',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={previewUrl}
                    alt="Selected Face"
                    style={{
                      maxHeight: '240px',
                      borderRadius: '8px',
                      objectFit: 'contain',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                  <p style={{ marginTop: '8px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                    Click to change image ({selectedFile?.name})
                  </p>
                </div>
              ) : (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, color: 'var(--primary)', margin: '0 auto 12px auto' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="placeholder-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    Select Face Image for Authentication
                  </p>
                  <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Supports JPEG, PNG, WebP or BMP format
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Input Mode: Live Camera */}
        {inputMode === 'camera' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxHeight: '320px',
                background: '#000',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  maxHeight: '320px',
                  objectFit: 'cover',
                  display: cameraActive ? 'block' : 'none',
                }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {!cameraActive && (
                <div style={{ padding: '40px', color: 'var(--text-muted)' }}>
                  {cameraError ? (
                    <p style={{ color: '#ef4444' }}>{cameraError}</p>
                  ) : (
                    <p>Initializing camera stream...</p>
                  )}
                </div>
              )}
            </div>

            {cameraActive && (
              <div style={{ marginTop: '12px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={capturePhoto}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                  Snapshot Photo
                </button>
              </div>
            )}

            {previewUrl && inputMode === 'camera' && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Captured Frame Ready for Verification:
                </span>
                <img
                  src={previewUrl}
                  alt="Captured Frame"
                  style={{ maxHeight: '140px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="auth-controls" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleAuthenticate}
            disabled={!selectedFile || loading}
            style={{ width: '100%', maxWidth: '360px' }}
          >
            {loading ? (
              <span>Evaluating Neural Pipeline...</span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                Verify & Authenticate
              </>
            )}
          </button>
        </div>

        {/* Pipeline Stage Indicator when Loading */}
        {loading && (
          <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '10px' }}>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>
              PIPELINE PROGRESSION
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {steps.map((step, idx) => {
                const isActive = idx === activeStep
                const isDone = idx < activeStep
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      background: isActive
                        ? 'rgba(59,130,246,0.15)'
                        : isDone
                        ? 'rgba(16,185,129,0.1)'
                        : 'var(--bg-primary)',
                      border: isActive
                        ? '1px solid var(--primary)'
                        : isDone
                        ? '1px solid #10b981'
                        : '1px solid var(--border-color)',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: isActive ? 'var(--primary)' : isDone ? '#10b981' : 'var(--text-muted)' }}>
                      {isDone ? '✓ ' : ''}{step.label}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {step.desc}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-16" style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 'var(--font-sm)' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Verification Decision & Risk Metrics Result Card */}
      {result && statusConfig && (
        <div className="result-section animate-in" id="auth-result-section" style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div
            className="card"
            style={{
              borderLeft: `5px solid ${statusConfig.border}`,
              background: statusConfig.bg,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
          >
            {/* Header Status Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{statusConfig.icon}</span>
                <span style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: statusConfig.color }}>
                  {statusConfig.title}
                </span>
              </div>
              <span className={`badge ${statusConfig.badgeClass}`} style={{ padding: '6px 12px', fontSize: 'var(--font-xs)', fontWeight: 700 }}>
                {decision}
              </span>
            </div>

            {/* Explainable Decision Text Box */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                border: `1px solid ${statusConfig.border}`,
                marginBottom: '16px',
              }}
            >
              <div style={{ fontSize: '11px', textTransform: 'uppercase', tracking: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                Decision Explanation
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: 'var(--font-sm)', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
                {result.explanation || 'No decision explanation provided.'}
              </p>
              {result.reasons && result.reasons.length > 0 && (
                <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  {result.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Comprehensive Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                background: 'var(--bg-secondary)',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
              }}
            >
              {/* Person Name */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Verified Person</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {result.identity || result.matched_user?.name || 'Unauthenticated'}
                </p>
              </div>

              {/* Similarity Score */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Face Similarity</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: result.is_authenticated ? '#10b981' : '#f59e0b', margin: 0 }}>
                  {((result.similarity_score ?? result.best_similarity ?? 0) * 100).toFixed(2)}%
                </p>
              </div>

              {/* Liveness Score */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Liveness Score</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: result.is_live ? '#10b981' : '#ef4444', margin: 0 }}>
                  {((result.liveness_score ?? 0) * 100).toFixed(1)}% {result.is_live ? '(REAL)' : '(SPOOF)'}
                </p>
              </div>

              {/* Deepfake Probability */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Deepfake Probability</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: result.is_deepfake ? '#8b5cf6' : '#10b981', margin: 0 }}>
                  {((result.deepfake_probability ?? 0) * 100).toFixed(1)}% {result.is_deepfake ? '(SYNTHETIC)' : '(REAL)'}
                </p>
              </div>

              {/* Face Quality Score */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Face Quality Score</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: result.is_quality_passed !== false ? '#10b981' : '#f97316', margin: 0 }}>
                  {((result.quality_score ?? 1) * 100).toFixed(0)}% (Blur: {result.blur_score ?? 'N/A'})
                </p>
              </div>

              {/* Total Processing Time */}
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', display: 'block' }}>Total Processing Time</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  {result.total_processing_time ?? result.timing_ms?.total_ms ?? 0} ms
                </p>
              </div>
            </div>

            {/* Stage Latency Pills */}
            {result.timing_ms && (
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                <span className="badge badge-secondary" style={{ fontSize: '11px' }}>Detect: {result.timing_ms.detection_ms ?? 0}ms</span>
                <span className="badge badge-secondary" style={{ fontSize: '11px' }}>Quality: {result.timing_ms.quality_ms ?? 0}ms</span>
                <span className="badge badge-secondary" style={{ fontSize: '11px' }}>Liveness: {result.timing_ms.liveness_ms ?? 0}ms</span>
                <span className="badge badge-secondary" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontSize: '11px' }}>
                  Deepfake: {result.timing_ms.deepfake_ms ?? 0}ms
                </span>
                <span className="badge badge-secondary" style={{ fontSize: '11px' }}>Embedding: {result.timing_ms.embedding_ms ?? 0}ms</span>
                <span className="badge badge-secondary" style={{ fontSize: '11px' }}>1:N FAISS: {result.timing_ms.search_ms ?? 0}ms</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Authenticate
