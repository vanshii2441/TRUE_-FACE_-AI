import { useState } from 'react'

function Register() {
  const [formData, setFormData] = useState({ userId: '', name: '' })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // TODO: Step 2 — connect to POST /register with face image
    alert(`Registration not yet connected.\n\nUser ID: ${formData.userId}\nName: ${formData.name}`)
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Register New User</h1>
        <p>
          Enroll a new identity into the True Face AI system. Capture or upload a clear face photo
          along with user details.
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

            <button type="submit" className="btn btn-primary btn-lg mt-8" id="register-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="16" y1="11" x2="22" y2="11" />
              </svg>
              Register User
            </button>
          </form>
        </div>

        {/* Right: Face Capture Placeholder */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="card-icon info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <span className="card-title">Face Capture</span>
            </div>
            <span className="badge badge-warning">Step 2</span>
          </div>

          {/* Camera placeholder */}
          <div className="placeholder-area" id="camera-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p className="placeholder-label">Camera Preview</p>
            <p>Live camera capture will be available in Step 2</p>
          </div>

          {/* Upload placeholder */}
          <div className="placeholder-area mt-16" id="upload-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="placeholder-label">Image Upload</p>
            <p>Drag and drop or click to upload a face photo</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
