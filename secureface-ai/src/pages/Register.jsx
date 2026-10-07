import { useState, useRef, useEffect } from 'react'
import { registerUser } from '../services/api'

function Register() {
  const [formData, setFormData] = useState({ userId: '', name: '', email: '' })
  const [formErrors, setFormErrors] = useState({})

  const [inputMode, setInputMode] = useState('upload') // 'upload' | 'camera'
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  // Status state: 'idle' | 'uploading' | 'detecting' | 'checking liveness' | 'processing embedding' | 'enrolling' | 'success' | 'error'
  const [status, setStatus] = useState('idle')
  const [activeStep, setActiveStep] = useState(0)
  const [result, setResult] = useState(null)
  const [apiError, setApiError] = useState(null)

  // Camera state
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)

  const steps = [
    { label: '1. Face Detection', desc: 'MTCNN Localization' },
    { label: '2. Quality Check', desc: 'Blur & Illumination' },
    { label: '3. Liveness Check', desc: 'Anti-Spoofing CNN' },
    { label: '4. Deepfake Check', desc: 'DeepfakeNet Model' },
    { label: '5. Face Processing', desc: '512d ArcFace Embedding' },
    { label: '6. FAISS Update', desc: '1:N Vector Indexing' },
    { label: '7. Completed', desc: 'User Registration' },
  ]

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
      console.error('Camera error:', err)
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
    setApiError(null)
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
        const file = new File([blob], `enrollment_snapshot_${Date.now()}.jpg`, { type: 'image/jpeg' })
        setSelectedFile(file)
        setPreviewUrl(URL.createObjectURL(blob))
        setResult(null)
        setApiError(null)
      }
    }, 'image/jpeg', 0.95)
  }

  const handleRetake = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setResult(null)
    setApiError(null)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']
      if (!validTypes.includes(file.type)) {
        setApiError('Unsupported file type. Please upload a JPEG, PNG, WebP, or BMP image.')
        return
      }

      // Validate max image size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setApiError('Image file size exceeds the 10 MB maximum limit.')
        return
      }

      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setResult(null)
      setApiError(null)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }))
    }
  }

  const validateForm = () => {
    const errors = {}
    const userIdClean = formData.userId.trim()
    const nameClean = formData.name.trim()
    const emailClean = formData.email.trim()

    if (!userIdClean) {
      errors.userId = 'User ID is required.'
    } else if (!/^[A-Za-z0-9_-]{3,32}$/.test(userIdClean)) {
      errors.userId = 'User ID must be 3-32 characters (letters, numbers, hyphens, underscores).'
    }

    if (!nameClean) {
      errors.name = 'Full Name is required.'
    } else if (nameClean.length < 2) {
      errors.name = 'Full Name must be at least 2 characters.'
    }

    if (emailClean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      errors.email = 'Please enter a valid email address.'
    }

    if (!selectedFile) {
      errors.file = 'Please select or capture a face image for enrollment.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setStatus('uploading')
    setActiveStep(0)
    setApiError(null)
    setResult(null)

    // Simulate multi-stage visual progression
    const t1 = setTimeout(() => { setStatus('detecting'); setActiveStep(1) }, 200)
    const t2 = setTimeout(() => { setStatus('checking liveness'); setActiveStep(2) }, 500)
    const t3 = setTimeout(() => { setStatus('processing embedding'); setActiveStep(4) }, 800)
    const t4 = setTimeout(() => { setStatus('enrolling'); setActiveStep(5) }, 1100)

    try {
      const payload = new FormData()
      payload.append('user_id', formData.userId.trim())
      payload.append('name', formData.name.trim())
      if (formData.email.trim()) {
        payload.append('email', formData.email.trim())
      }
      payload.append('file', selectedFile)

      const response = await registerUser(payload)

      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)

      setActiveStep(6)
      setStatus('success')
      setResult(response)

      // Reset form
      setFormData({ userId: '', name: '', email: '' })
      setSelectedFile(null)
      setPreviewUrl(null)
    } catch (err) {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)

      setStatus('error')
      
      // Parse structured error detail
      const errMsg = err.message || 'Enrollment request failed.'
      setApiError(errMsg)
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>User Registration & Biometric Enrollment</h1>
        <p>
          Register a new identity with MTCNN detection, quality checks, passive anti-spoofing, deepfake verification, 512d ArcFace embedding, and FAISS vector indexing.
        </p>
      </div>

      <div className="register-layout" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '24px' }}>
        {/* Left: User Details Form */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="card-icon primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
              </div>
              <span className="card-title">Enrollment Details</span>
            </div>
            {status === 'success' && <span className="badge badge-success">Enrolled</span>}
          </div>

          <form className="register-form" onSubmit={handleSubmit} id="register-form">
            {/* User ID */}
            <div className="form-group">
              <label className="form-label" htmlFor="userId">
                User ID <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                className={`form-input ${formErrors.userId ? 'error' : ''}`}
                type="text"
                id="userId"
                name="userId"
                placeholder="e.g. USR001"
                value={formData.userId}
                onChange={handleChange}
                disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
              />
              {formErrors.userId && (
                <div style={{ fontSize: 'var(--font-xs)', color: '#ef4444', marginTop: '4px' }}>
                  {formErrors.userId}
                </div>
              )}
            </div>

            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Full Display Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                className={`form-input ${formErrors.name ? 'error' : ''}`}
                type="text"
                id="name"
                name="name"
                placeholder="e.g. Aarav Sharma"
                value={formData.name}
                onChange={handleChange}
                disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
              />
              {formErrors.name && (
                <div style={{ fontSize: 'var(--font-xs)', color: '#ef4444', marginTop: '4px' }}>
                  {formErrors.name}
                </div>
              )}
            </div>

            {/* Email / Identifier */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>(Optional)</span>
              </label>
              <input
                className={`form-input ${formErrors.email ? 'error' : ''}`}
                type="email"
                id="email"
                name="email"
                placeholder="e.g. aarav@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
              />
              {formErrors.email && (
                <div style={{ fontSize: 'var(--font-xs)', color: '#ef4444', marginTop: '4px' }}>
                  {formErrors.email}
                </div>
              )}
            </div>

            {formErrors.file && (
              <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', color: '#ef4444', fontSize: 'var(--font-xs)', marginBottom: '12px' }}>
                ⚠️ {formErrors.file}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg mt-8"
              id="register-btn"
              disabled={status !== 'idle' && status !== 'success' && status !== 'error'}
              style={{ width: '100%' }}
            >
              {status !== 'idle' && status !== 'success' && status !== 'error' ? (
                <span>Executing Enrollment Pipeline...</span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="16" y1="11" x2="22" y2="11" />
                  </svg>
                  Submit & Enroll User
                </>
              )}
            </button>
          </form>

          {/* Structured API Error Message Box */}
          {apiError && (
            <div className="mt-16 animate-in" style={{ padding: '14px 16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 'var(--font-sm)' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Enrollment Failed</div>
              <p style={{ margin: 0 }}>{apiError}</p>
            </div>
          )}

          {/* Success Summary Box */}
          {result && status === 'success' && (
            <div className="mt-16 animate-in" style={{ padding: '16px', borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={{ color: '#10b981', fontWeight: 700, fontSize: 'var(--font-md)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✓ Biometric Enrollment Complete!
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>User ID:</span>
                  <p style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', margin: 0 }}>{result.user_id}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Name:</span>
                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{result.name}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>FAISS Vector ID:</span>
                  <p style={{ fontWeight: 700, color: '#10b981', fontFamily: 'monospace', margin: 0 }}>#{result.faiss_id}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Liveness Verification:</span>
                  <p style={{ fontWeight: 700, color: '#10b981', margin: 0 }}>{((result.liveness_score ?? 1) * 100).toFixed(1)}% REAL</p>
                </div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                User is immediately active and available for 1:N authentication searches.
              </div>
            </div>
          )}
        </div>

        {/* Right: Face Capture & Multi-Stage Pipeline Progress */}
        <div>
          {/* Capture Box Card */}
          <div className="card mb-24">
            <div className="card-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="card-icon info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <span className="card-title">Face Image Capture</span>
              </div>

              <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: '6px', gap: '3px' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${inputMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleModeChange('upload')}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${inputMode === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleModeChange('camera')}
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                >
                  Webcam
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
                  className="placeholder-area"
                  style={{
                    cursor: 'pointer',
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '20px',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewUrl ? (
                    <div>
                      <img
                        src={previewUrl}
                        alt="Enrollment Face Preview"
                        style={{ maxHeight: '180px', borderRadius: '8px', objectFit: 'contain', border: '1px solid var(--border-color)' }}
                      />
                      <p style={{ marginTop: '6px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                        Click to change photo ({selectedFile?.name})
                      </p>
                    </div>
                  ) : (
                    <>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', opacity: 0.7, margin: '0 auto 8px auto' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p className="placeholder-label" style={{ fontWeight: 600 }}>Select Clear Face Photo</p>
                      <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                        JPEG, PNG, WebP or BMP format with exactly 1 face.
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
                    maxHeight: '220px',
                    background: '#000',
                    borderRadius: '8px',
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
                      maxHeight: '220px',
                      objectFit: 'cover',
                      display: cameraActive ? 'block' : 'none',
                    }}
                  />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />

                  {!cameraActive && (
                    <div style={{ padding: '30px', color: 'var(--text-muted)', fontSize: 'var(--font-xs)' }}>
                      {cameraError ? <p style={{ color: '#ef4444' }}>{cameraError}</p> : <p>Starting camera...</p>}
                    </div>
                  )}
                </div>

                {cameraActive && (
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={capturePhoto}>
                      📷 Capture Photo
                    </button>
                    {previewUrl && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleRetake}>
                        🔄 Retake
                      </button>
                    )}
                  </div>
                )}

                {previewUrl && inputMode === 'camera' && (
                  <div style={{ marginTop: '12px', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Captured Preview:</span>
                    <img src={previewUrl} alt="Captured" style={{ maxHeight: '100px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live Step Progress Indicator */}
          <div className="card">
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', tracking: '0.05em' }}>
              Enrollment Pipeline Stages
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {steps.map((st, idx) => {
                const isCurrent = idx === activeStep && status !== 'idle' && status !== 'success'
                const isPassed = idx < activeStep || status === 'success'
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: isCurrent
                        ? 'rgba(59,130,246,0.1)'
                        : isPassed
                        ? 'rgba(16,185,129,0.06)'
                        : 'var(--bg-secondary)',
                      border: isCurrent
                        ? '1px solid var(--primary)'
                        : isPassed
                        ? '1px solid rgba(16,185,129,0.3)'
                        : '1px solid transparent',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: isPassed ? '#10b981' : isCurrent ? 'var(--primary)' : 'var(--border-color)',
                        color: '#fff',
                      }}
                    >
                      {isPassed ? '✓' : idx + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: isPassed ? '#10b981' : isCurrent ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {st.label}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{st.desc}</div>
                    </div>

                    {isCurrent && (
                      <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
                        Processing...
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
