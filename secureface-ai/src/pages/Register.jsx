import { useState, useRef } from 'react'
import { registerUser } from '../services/api'

function Register() {
  const [formData, setFormData] = useState({ userId: '', name: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setError(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedFile) {
      setError('Please select or upload a face photo for enrollment.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const payload = new FormData()
      payload.append('user_id', formData.userId.trim())
      payload.append('name', formData.name.trim())
      payload.append('file', selectedFile)

      const response = await registerUser(payload)
      setResult(response)
      setFormData({ userId: '', name: '' })
      setSelectedFile(null)
      setPreviewUrl(null)
    } catch (err) {
      setError(err.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Register New User</h1>
        <p>
          Enroll a new identity into the TRUE FACE AI system.
          Extracts a 512d ArcFace feature vector and indexes it into the FAISS database after verifying liveness.
        </p>
      </div>

      <div className="register-layout">
        {/* Left: Form */}
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
              <span className="card-title">User Details</span>
            </div>
          </div>

          <form className="register-form" onSubmit={handleSubmit} id="register-form">
            <div className="form-group">
              <label className="form-label" htmlFor="userId">User ID</label>
              <input
                className="form-input"
                type="text"
                id="userId"
                name="userId"
                placeholder="e.g. USR001"
                value={formData.userId}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name</label>
              <input
                className="form-input"
                type="text"
                id="name"
                name="name"
                placeholder="e.g. Aarav Sharma"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg mt-8" id="register-btn" disabled={loading}>
              {loading ? (
                <span>Enrolling User...</span>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="16" y1="11" x2="22" y2="11" />
                  </svg>
                  Register User
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-16" style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 'var(--font-sm)' }}>
              ⚠️ {error}
            </div>
          )}

          {result && (
            <div className="mt-16" style={{ padding: '16px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={{ color: '#10b981', fontWeight: 600, fontSize: 'var(--font-sm)', marginBottom: '8px' }}>
                ✓ User Enrolled Successfully!
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                <p><strong>User ID:</strong> {result.user_id}</p>
                <p><strong>Name:</strong> {result.name}</p>
                <p><strong>FAISS Vector ID:</strong> #{result.faiss_id}</p>
                <p><strong>Liveness Verification:</strong> {(result.liveness_score * 100).toFixed(1)}% REAL</p>
                <p><strong>Total Latency:</strong> {result.timing_ms?.total_ms}ms</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Face Image Upload */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="card-icon info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <span className="card-title">Face Image Upload</span>
            </div>
            {selectedFile && <span className="badge badge-success">Image Ready</span>}
          </div>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <div
            className="placeholder-area"
            style={{ cursor: 'pointer', border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div>
                <img
                  src={previewUrl}
                  alt="Enrollment Face Preview"
                  style={{ maxHeight: '200px', borderRadius: '8px', objectFit: 'contain' }}
                />
                <p style={{ marginTop: '8px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  Click to change image ({selectedFile?.name})
                </p>
              </div>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="placeholder-label">Upload Clear Face Photo</p>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  Click to select JPEG, PNG, or WebP photo with 1 clear face.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
