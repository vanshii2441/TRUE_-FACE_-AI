import { useState } from 'react'

function Authenticate() {
  const [activeTab, setActiveTab] = useState('camera')

  const handleCapture = () => {
    alert('Camera capture will be available in Step 2.')
  }

  const handleAuthenticate = () => {
    alert('Authentication will be available in Step 2.')
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Live Authentication</h1>
        <p>
          Verify a person's identity by capturing their face via camera or uploading an image.
          The system will compare the face against all registered users.
        </p>
      </div>

      {/* Tab Toggle */}
      <div className="auth-tabs" id="auth-mode-tabs">
        <button
          className={`auth-tab ${activeTab === 'camera' ? 'active' : ''}`}
          onClick={() => setActiveTab('camera')}
          id="tab-camera"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Camera
          </span>
        </button>
        <button
          className={`auth-tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
          id="tab-upload"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </span>
        </button>
      </div>

      {/* Preview Area */}
      <div className="auth-preview" id="auth-preview-area">
        {activeTab === 'camera' ? (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25, color: 'var(--text-muted)' }}>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p className="placeholder-label">Camera Feed</p>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', maxWidth: '300px' }}>
              Live camera preview will appear here. Camera integration will be added in Step 2.
            </p>
          </>
        ) : (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25, color: 'var(--text-muted)' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="placeholder-label">Upload Image</p>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', maxWidth: '300px' }}>
              Drag and drop a face photo here, or click to browse files. Upload functionality will be added in Step 2.
            </p>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="auth-controls">
        <button className="btn btn-secondary" onClick={handleCapture} id="capture-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Capture
        </button>
        <button className="btn btn-primary" onClick={handleAuthenticate} id="authenticate-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Authenticate
        </button>
      </div>

      {/* Result Section */}
      <div className="result-section" id="auth-result-section">
        <div className="section-title">Authentication Result</div>
        <div className="result-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p>
            Authentication result will appear here after a face is captured and verified.
          </p>
          <p style={{ marginTop: '4px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            The system will display: Name, User ID, Confidence Score, and Verification Status.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Authenticate
