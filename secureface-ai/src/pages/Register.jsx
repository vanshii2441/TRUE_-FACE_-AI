import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { registerUser, sendOtp, verifyOtp } from '../services/api'
import Breadcrumb from '../components/Breadcrumb'

function Register() {
  const [formData, setFormData] = useState({
    userId: '',
    name: '',
    email: '',
  })
  const [formErrors, setFormErrors] = useState({})

  // OTP Verification state
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpMessage, setOtpMessage] = useState('')
  const [cooldown, setCooldown] = useState(0)

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Image capture & upload state
  const [inputMode, setInputMode] = useState('upload') // 'upload' | 'camera'
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [enrollmentResult, setEnrollmentResult] = useState(null)
  const [apiError, setApiError] = useState(null)

  // Camera state
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

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
      setCameraError('Unable to access webcam. Check permissions or upload a photo.')
      setCameraActive(false)
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

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
        const file = new File([blob], `enrollment_${Date.now()}.jpg`, { type: 'image/jpeg' })
        setSelectedFile(file)
        setPreviewUrl(URL.createObjectURL(blob))
        setEnrollmentResult(null)
        setApiError(null)
      }
    }, 'image/jpeg', 0.95)
  }

  const handleRetake = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setEnrollmentResult(null)
    setApiError(null)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']
      if (!validTypes.includes(file.type)) {
        setApiError('Unsupported format. Please upload a JPEG, PNG, or WebP image.')
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setApiError('File size exceeds 10 MB maximum limit.')
        return
      }

      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setEnrollmentResult(null)
      setApiError(null)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }))
    }
    if (name === 'email') {
      setOtp('')
      setOtpSent(false)
      setOtpVerified(false)
      setOtpMessage('')
      setCooldown(0)
    }
  }

  const handleSendOtp = async () => {
    const emailClean = formData.email.trim()
    if (!emailClean) {
      setFormErrors((prev) => ({ ...prev, email: 'Email address is required to dispatch OTP.' }))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      setFormErrors((prev) => ({ ...prev, email: 'Enter a valid email address.' }))
      return
    }

    setOtpLoading(true)
    setOtpMessage('Sending verification OTP...')
    setApiError(null)

    try {
      const res = await sendOtp(emailClean)
      setOtpSent(true)
      setOtpVerified(false)
      setCooldown(res.cooldown_seconds || 60)
      setOtpMessage(res.message || `OTP code sent to ${emailClean}. Valid for 2 minutes.`)
    } catch (err) {
      setOtpMessage('')
      const match = err.message?.match(/(\d+)\s*seconds/)
      if (match) {
        setCooldown(parseInt(match[1], 10))
      }
      setFormErrors((prev) => ({
        ...prev,
        email: err.message || 'Failed to dispatch OTP. Verify SMTP configuration.',
      }))
    } finally {
      setOtpLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    const emailClean = formData.email.trim()
    if (!emailClean || otp.length !== 6) {
      setOtpMessage('Please enter the complete 6-digit code.')
      return
    }

    setOtpLoading(true)
    setOtpMessage('Verifying code...')
    setApiError(null)

    try {
      const res = await verifyOtp(emailClean, otp)
      setOtpVerified(true)
      setOtpMessage(res.message || 'Email verified successfully.')
      if (formErrors.otp) {
        setFormErrors((prev) => ({ ...prev, otp: null }))
      }
    } catch (err) {
      setOtpVerified(false)
      setOtpMessage('')
      setFormErrors((prev) => ({
        ...prev,
        otp: err.message || 'Invalid or expired OTP code.',
      }))
    } finally {
      setOtpLoading(false)
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
      errors.userId = 'User ID must be 3-32 characters (alphanumeric, hyphens, underscores).'
    }

    if (!nameClean) {
      errors.name = 'Full display name is required.'
    } else if (nameClean.length < 2) {
      errors.name = 'Name must be at least 2 characters.'
    }

    if (!emailClean) {
      errors.email = 'Corporate or academic email address is compulsory for biometric registration.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      errors.email = 'Please provide a valid corporate or academic email address (e.g. name@gla.ac.in).'
    }

    if (!selectedFile) {
      errors.file = 'Please provide a face image via live camera capture or photo upload.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm() || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setApiError(null)
    setEnrollmentResult(null)

    try {
      const payload = new FormData()
      payload.append('user_id', formData.userId.trim())
      payload.append('name', formData.name.trim())
      payload.append('email', formData.email.trim())
      payload.append('file', selectedFile)

      const response = await registerUser(payload)
      setEnrollmentResult(response)

      // Clear form on success
      setFormData({ userId: '', name: '', email: '' })
      setOtp('')
      setOtpSent(false)
      setOtpVerified(false)
      setOtpMessage('')
      setSelectedFile(null)
      setPreviewUrl(null)
    } catch (err) {
      setApiError(err.message || 'Enrollment request failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="register-container animate-in">
      <Breadcrumb items={[{ label: 'Enroll User' }]} />

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Biometric Identity Enrollment</h1>
          <p className="page-subtitle">
            Extract and store a 512-dimensional ArcFace embedding in the FAISS vector database with passive anti-spoofing gating.
          </p>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="enrollment-stepper-bar mb-24">
        <div className="stepper-step active">
          <span className="step-number">01</span>
          <div className="step-info">
            <span className="step-title">Identity & Contact</span>
            <span className="step-desc">ID, Name & Compulsory Email</span>
          </div>
        </div>
        <div className="stepper-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
        <div className={`stepper-step ${selectedFile ? 'active' : ''}`}>
          <span className="step-number">02</span>
          <div className="step-info">
            <span className="step-title">Biometric Capture</span>
            <span className="step-desc">Frontal Facial Photo</span>
          </div>
        </div>
        <div className="stepper-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
        <div className={`stepper-step ${enrollmentResult ? 'active' : ''}`}>
          <span className="step-number">03</span>
          <div className="step-info">
            <span className="step-title">FAISS Vector Index</span>
            <span className="step-desc">512d ArcFace Vector</span>
          </div>
        </div>
      </div>

      <div className="register-two-column-layout mb-24">
        {/* Left Column: Enrollment Form */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-title-group">
              <h3 className="card-title">Identity Profile Credentials</h3>
              <p className="card-subtitle">Provide unique user attributes and compulsory contact</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* User ID Field */}
            <div className="form-group mb-16">
              <label htmlFor="userId" className="form-label">
                User ID <span className="required-mark">*</span>
              </label>
              <div className="input-with-icon-group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="input-leading-icon">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="10" r="2" />
                  <line x1="15" y1="8" x2="17" y2="8" />
                  <line x1="15" y1="12" x2="17" y2="12" />
                  <line x1="7" y1="16" x2="17" y2="16" />
                </svg>
                <input
                  id="userId"
                  type="text"
                  name="userId"
                  className={`input ${formErrors.userId ? 'input-error' : ''}`}
                  placeholder="e.g. USR_1042"
                  value={formData.userId}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  autoComplete="off"
                />
              </div>
              {formErrors.userId ? (
                <span className="field-error-text">{formErrors.userId}</span>
              ) : (
                <span className="field-hint-text">Unique alphanumeric identifier used for 1:N FAISS recognition lookups.</span>
              )}
            </div>

            {/* Full Name Field */}
            <div className="form-group mb-16">
              <label htmlFor="name" className="form-label">
                Full Display Name <span className="required-mark">*</span>
              </label>
              <div className="input-with-icon-group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="input-leading-icon">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="name"
                  type="text"
                  name="name"
                  className={`input ${formErrors.name ? 'input-error' : ''}`}
                  placeholder="e.g. Sarah Jenkins"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>
              {formErrors.name && <span className="field-error-text">{formErrors.name}</span>}
            </div>

            {/* Compulsory Email & OTP Section */}
            <div className="form-group mb-20">
              <label htmlFor="email" className="form-label">
                Email Address <span className="required-mark">*</span>
              </label>
              <div className="input-with-button-group">
                <div className="input-with-icon-group">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="input-leading-icon">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    className={`input ${formErrors.email ? 'input-error' : ''}`}
                    placeholder="e.g. sarah.jenkins@company.com or name@gla.ac.in"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                </div>
                {formData.email && !otpVerified && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSendOtp}
                    disabled={otpLoading || cooldown > 0 || isSubmitting}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {otpLoading
                      ? 'Sending...'
                      : cooldown > 0
                      ? `Resend (${cooldown}s)`
                      : 'Send OTP'}
                  </button>
                )}
              </div>
              {formErrors.email ? (
                <span className="field-error-text">{formErrors.email}</span>
              ) : (
                <span className="field-hint-text">
                  Compulsory verification contact for multi-factor identity authorization and security audit records.
                </span>
              )}

              {/* OTP Input Row */}
              {otpSent && !otpVerified && (
                <div className="otp-verification-box mt-12 animate-in">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Enter 6-Digit Email Verification Code:
                    </span>
                    {cooldown > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Expires in {cooldown}s
                      </span>
                    )}
                  </div>
                  <div className="input-with-button-group">
                    <input
                      type="text"
                      className={`input input-monospace ${formErrors.otp ? 'input-error' : ''}`}
                      placeholder="000000"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      disabled={isSubmitting || otpLoading}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleVerifyOtp}
                      disabled={otp.length !== 6 || otpLoading || isSubmitting}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {otpLoading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </div>
                  {formErrors.otp && <span className="field-error-text">{formErrors.otp}</span>}
                  {otpMessage && <span className="field-hint-text">{otpMessage}</span>}
                </div>
              )}

              {otpVerified && (
                <div className="verified-email-badge mt-8 animate-in">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mini-icon">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Email verified via SMTP OTP</span>
                </div>
              )}
            </div>

            {formErrors.file && (
              <div className="alert-banner alert-danger mb-16">
                <span>{formErrors.file}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={isSubmitting}
              id="submit-enrollment-btn"
            >
              {isSubmitting ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon spin">
                    <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                    <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
                  </svg>
                  Processing Biometric Embedding Pipeline...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="16" y1="11" x2="22" y2="11" />
                  </svg>
                  Enroll Biometric Identity
                </>
              )}
            </button>
          </form>

          {/* Structured Error Message */}
          {apiError && (
            <div className="alert-banner alert-danger mt-16">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <strong>Enrollment Failed:</strong>
                <p style={{ margin: '4px 0 0 0' }}>{apiError}</p>
              </div>
            </div>
          )}

          {/* Enrollment Success Box */}
          {enrollmentResult && (
            <div className="enrollment-success-card mt-16 animate-in">
              <div className="success-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="success-icon">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <h4>Biometric Enrollment Completed Successfully</h4>
              </div>

              <div className="success-details-grid">
                <div>
                  <span className="detail-label">User ID:</span>
                  <strong className="detail-value monospace-text">{enrollmentResult.user_id}</strong>
                </div>
                <div>
                  <span className="detail-label">Display Name:</span>
                  <strong className="detail-value">{enrollmentResult.name}</strong>
                </div>
                <div>
                  <span className="detail-label">FAISS Vector Index:</span>
                  <strong className="detail-value">#{enrollmentResult.faiss_id}</strong>
                </div>
                <div>
                  <span className="detail-label">Embedding Dimensions:</span>
                  <strong className="detail-value">512d L2 Normalized</strong>
                </div>
              </div>

              <div className="success-actions-row mt-12">
                <Link to="/users" className="btn btn-secondary btn-sm">
                  View in Identity Database →
                </Link>
                <Link to="/authenticate" className="btn btn-primary btn-sm">
                  Verify This Identity →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Facial Capture / Photo Selection */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-title-group">
              <h3 className="card-title">Biometric Facial Sample</h3>
              <p className="card-subtitle">High-quality, frontal face image required for vector generation</p>
            </div>

            <div className="tab-pill-group">
              <button
                type="button"
                className={`tab-pill-btn ${inputMode === 'upload' ? 'active' : ''}`}
                onClick={() => handleModeChange('upload')}
              >
                Upload Photo
              </button>
              <button
                type="button"
                className={`tab-pill-btn ${inputMode === 'camera' ? 'active' : ''}`}
                onClick={() => handleModeChange('camera')}
              >
                Webcam
              </button>
            </div>
          </div>

          {inputMode === 'upload' && (
            <div className="upload-view-container">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/bmp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="enroll-file-upload-input"
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
                    <circle cx="12" cy="8" r="4" />
                    <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
                  </svg>
                  <h4>Click to Select Enrollment Photo</h4>
                  <p>JPEG, PNG, WebP format. Ensure clear frontal illumination and no motion blur.</p>
                </div>
              ) : (
                <div className="preview-viewport">
                  <img src={previewUrl} alt="Enrollment sample" className="preview-image-element" />
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

          {inputMode === 'camera' && (
            <div className="camera-view-container">
              {!previewUrl ? (
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
                      <span className="guideline-hint">Position frontal face in oval</span>
                    </div>
                  )}

                  {cameraError && (
                    <div className="camera-error-message">
                      <p>{cameraError}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="preview-viewport">
                  <img src={previewUrl} alt="Captured enrollment face" className="preview-image-element" />
                </div>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <div className="camera-controls-row">
                {!previewUrl ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={capturePhoto}
                    disabled={!cameraActive}
                  >
                    Capture Enrollment Frame
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleRetake}
                  >
                    Retake Photo
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quality Guidance Card */}
          <div className="quality-guidelines-box mt-20">
            <h5 className="guidelines-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Biometric Enrollment Standards
            </h5>
            <ul className="guidelines-checklist">
              <li className="guidelines-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="guidelines-check-icon">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Exactly <strong>one face</strong> visible in the capture frame (multiple faces rejected).</span>
              </li>
              <li className="guidelines-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="guidelines-check-icon">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Face crop dimension must exceed <strong>40 × 40 pixels</strong> for feature extraction.</span>
              </li>
              <li className="guidelines-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="guidelines-check-icon">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Minimal motion blur (Laplacian focus variance validated by backend).</span>
              </li>
              <li className="guidelines-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="guidelines-check-icon">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Direct frontal orientation with unobstructed eyes, nose, and mouth.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
