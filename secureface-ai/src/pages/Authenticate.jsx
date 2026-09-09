import { useState, useRef } from 'react'
import { recognizeFace } from '../services/api'

function Authenticate() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

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
      setError('Please select or upload a face image first.')
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
    } catch (err) {
      setError(err.message || 'Authentication request failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Live Authentication & Anti-Spoofing</h1>
        <p>
          Authenticate identities against the enrolled FAISS database.
          Each face undergo passive liveness anti-spoofing verification before 512d ArcFace vector matching.
        </p>
      </div>

      {/* Upload & Preview Card */}
      <div className="card mb-24" style={{ maxWidth: '640px', margin: '0 auto 24px auto' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span className="card-title">Query Image Input</span>
          </div>
          {selectedFile && (
            <span className="badge badge-success">Image Selected</span>
          )}
        </div>

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
                  maxHeight: '220px',
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
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, color: 'var(--primary)', margin: '0 auto 12px auto' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="placeholder-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Select Face Image for Authentication
              </p>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                Click to browse JPEG, PNG, or WebP files
              </p>
            </>
          )}
        </div>

        <div className="auth-controls" style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Select Image
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAuthenticate}
            disabled={!selectedFile || loading}
          >
            {loading ? (
              <span>Running AI Pipeline...</span>
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

        {error && (
          <div className="mt-16" style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 'var(--font-sm)' }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Result Section */}
      {result && (
        <div className="result-section animate-in" id="auth-result-section" style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div className="section-title">Authentication Result</div>

          {result.status === 'MATCH' && (
            <div className="card" style={{ borderLeft: '4px solid #10b981', background: 'rgba(16,185,129,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: 'var(--font-sm)' }}>
                  ✓ IDENTITY AUTHENTICATED
                </span>
                <span className="badge badge-primary">
                  Liveness: {(result.liveness_score * 100).toFixed(1)}% REAL
                </span>
              </div>

              {result.matched_user && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Name</span>
                    <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {result.matched_user.name}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>User ID</span>
                    <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {result.matched_user.user_id}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>ArcFace Match Similarity</span>
                    <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: '#10b981' }}>
                      {(result.matched_user.similarity * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Liveness Status</span>
                    <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: '#10b981' }}>
                      PASSED (Genuine Live Face)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {result.status === 'SPOOF_DETECTED' && (
            <div className="card" style={{ borderLeft: '4px solid #ef4444', background: 'rgba(239,68,68,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span className="badge badge-warning" style={{ background: '#ef4444', color: '#fff', padding: '6px 12px', fontSize: 'var(--font-sm)' }}>
                  🚫 SPOOF ATTACK BLOCKED
                </span>
                <span className="badge badge-danger">
                  Liveness: {(result.liveness_score * 100).toFixed(1)}% (SPOOF)
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}>
                The passive liveness anti-spoofing engine detected a presentation attack (e.g. printed photo or digital screen replay). Access rejected.
              </p>
            </div>
          )}

          {result.status === 'NO_MATCH' && (
            <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: 'var(--font-sm)' }}>
                  NO MATCH FOUND
                </span>
                <span className="badge badge-success">
                  Liveness: {(result.liveness_score * 100).toFixed(1)}% REAL
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}>
                Face passed liveness check, but similarity score did not match any enrolled user above threshold ({(result.threshold * 100).toFixed(0)}%).
              </p>
            </div>
          )}

          {result.status === 'NO_FACE_DETECTED' && (
            <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontWeight: 600, color: '#f59e0b', marginBottom: '4px' }}>
                No Face Detected
              </div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                MTCNN could not locate a clear human face in the uploaded image. Please try another photo.
              </p>
            </div>
          )}

          {/* Latency Breakdown */}
          {result.timing_ms && (
            <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              <span className="badge badge-secondary">Detection: {result.timing_ms.detection_ms}ms</span>
              <span className="badge badge-secondary">Liveness: {result.timing_ms.liveness_ms}ms</span>
              <span className="badge badge-secondary">Embedding: {result.timing_ms.embedding_ms}ms</span>
              <span className="badge badge-secondary">1:N FAISS Search: {result.timing_ms.search_ms}ms</span>
              <span className="badge badge-primary">Total Pipeline: {result.timing_ms.total_ms}ms</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Authenticate
