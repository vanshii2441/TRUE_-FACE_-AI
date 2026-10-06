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

  const decision = result?.final_decision || result?.status

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>Live Face Authentication & Deepfake Verification</h1>
        <p>
          End-to-end multi-layer AI security pipeline:
          Face Detection → Passive Liveness → Deepfake Detection → 512d ArcFace Embedding → FAISS 1:N Recognition.
        </p>
      </div>

      {/* Upload & Preview Card */}
      <div className="card mb-24" style={{ maxWidth: '680px', margin: '0 auto 24px auto' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="card-icon primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span className="card-title">Authentication Query Input</span>
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
              <span>Running Deep Learning Pipeline...</span>
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
        <div className="result-section animate-in" id="auth-result-section" style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div className="section-title" style={{ marginBottom: '16px', fontWeight: 600, fontSize: 'var(--font-lg)' }}>
            Verification Decision & Risk Metrics
          </div>

          {/* 1. AUTHENTICATED / MATCH */}
          {(decision === 'AUTHENTICATED' || decision === 'MATCH') && (
            <div className="card" style={{ borderLeft: '4px solid #10b981', background: 'rgba(16,185,129,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
                  ✓ AUTHENTICATED
                </span>
                <span className="badge badge-primary">
                  Liveness: {((result.liveness_score ?? 1) * 100).toFixed(1)}% REAL
                </span>
                <span className="badge badge-info">
                  Deepfake Prob: {((result.deepfake_probability ?? 0) * 100).toFixed(1)}%
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Identity</span>
                  <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {result.identity || result.matched_user?.name || 'Verified User'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>User ID</span>
                  <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {result.matched_user?.user_id || 'N/A'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Similarity Score</span>
                  <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: '#10b981' }}>
                    {(((result.similarity_score ?? result.best_similarity ?? 0)) * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Final Decision</span>
                  <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: '#10b981' }}>
                    AUTHENTICATED
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. UNKNOWN_USER / NO_MATCH */}
          {(decision === 'UNKNOWN_USER' || decision === 'NO_MATCH') && (
            <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
                  ⚠️ UNKNOWN USER
                </span>
                <span className="badge badge-success">
                  Liveness: {((result.liveness_score ?? 1) * 100).toFixed(1)}% REAL
                </span>
                <span className="badge badge-info">
                  Deepfake Prob: {((result.deepfake_probability ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: 'var(--font-sm)', marginBottom: '12px' }}>
                Face passed anti-spoofing and deepfake checks, but face similarity score did not match any enrolled user above the threshold ({(result.threshold * 100).toFixed(0)}%).
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Best Similarity Score</span>
                  <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: '#f59e0b' }}>
                    {(((result.similarity_score ?? result.best_similarity ?? 0)) * 100).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Final Decision</span>
                  <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: '#f59e0b' }}>
                    UNKNOWN_USER
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. LIVENESS_FAILED / SPOOF_DETECTED */}
          {(decision === 'LIVENESS_FAILED' || decision === 'SPOOF_DETECTED') && (
            <div className="card" style={{ borderLeft: '4px solid #ef4444', background: 'rgba(239,68,68,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span className="badge badge-danger" style={{ background: '#ef4444', color: '#fff', padding: '6px 12px', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
                  🚫 LIVENESS FAILED
                </span>
                <span className="badge badge-danger">
                  Liveness Score: {((result.liveness_score ?? 0) * 100).toFixed(1)}% (SPOOF)
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: 'var(--font-sm)', marginBottom: '12px' }}>
                The passive liveness anti-spoofing engine detected a presentation attack (e.g., printed photo, screen photo, or video replay). Authentication blocked.
              </p>
              <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Final Decision</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: '#ef4444' }}>
                  LIVENESS_FAILED
                </p>
              </div>
            </div>
          )}

          {/* 4. DEEPFAKE_SUSPECTED */}
          {decision === 'DEEPFAKE_SUSPECTED' && (
            <div className="card" style={{ borderLeft: '4px solid #8b5cf6', background: 'rgba(139,92,246,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: '#8b5cf6', color: '#fff', padding: '6px 12px', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
                  🤖 DEEPFAKE SUSPECTED
                </span>
                <span className="badge" style={{ background: 'rgba(139,92,246,0.2)', color: '#8b5cf6' }}>
                  Deepfake Prob: {((result.deepfake_probability ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: 'var(--font-sm)', marginBottom: '12px' }}>
                The DeepfakeNet neural network detected synthetic face manipulation (e.g. AI face-swap, GAN/Diffusion generation, or neural facial edits). Access blocked.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Deepfake Probability</span>
                  <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: '#8b5cf6' }}>
                    {((result.deepfake_probability ?? 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Final Decision</span>
                  <p style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: '#8b5cf6' }}>
                    DEEPFAKE_SUSPECTED
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5. NO_FACE / NO_FACE_DETECTED */}
          {(decision === 'NO_FACE' || decision === 'NO_FACE_DETECTED') && (
            <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.05)' }}>
              <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '6px', fontSize: 'var(--font-md)' }}>
                ❓ NO FACE DETECTED
              </div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                MTCNN face detection layer could not locate a human face in the query image. Please upload a clear photo with a single face.
              </p>
            </div>
          )}

          {/* 6. LOW_CONFIDENCE / MULTIPLE_FACES_DETECTED */}
          {(decision === 'LOW_CONFIDENCE' || decision === 'MULTIPLE_FACES_DETECTED') && (
            <div className="card" style={{ borderLeft: '4px solid #eab308', background: 'rgba(234,179,8,0.05)' }}>
              <div style={{ fontWeight: 700, color: '#eab308', marginBottom: '6px', fontSize: 'var(--font-md)' }}>
                ⚠️ LOW CONFIDENCE / MULTIPLE FACES
              </div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                Face detection confidence was below the configured threshold ({result.threshold ? `${result.threshold * 100}%` : 'threshold'}), or multiple faces were detected.
              </p>
            </div>
          )}

          {/* 7. SYSTEM_ERROR */}
          {decision === 'SYSTEM_ERROR' && (
            <div className="card" style={{ borderLeft: '4px solid #ef4444', background: 'rgba(239,68,68,0.08)' }}>
              <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: '6px', fontSize: 'var(--font-md)' }}>
                💥 SYSTEM ERROR
              </div>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
                An internal processing error occurred while evaluating the biometric pipeline. Please check server logs and try again.
              </p>
            </div>
          )}

          {/* Latency Breakdown & Metrics Pill Row */}
          {result.timing_ms && (
            <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              <span className="badge badge-secondary">Face Detection: {result.timing_ms.detection_ms ?? 0}ms</span>
              <span className="badge badge-secondary">Liveness: {result.timing_ms.liveness_ms ?? 0}ms</span>
              <span className="badge badge-secondary" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
                Deepfake: {result.timing_ms.deepfake_ms ?? 0}ms
              </span>
              <span className="badge badge-secondary">Embedding: {result.timing_ms.embedding_ms ?? 0}ms</span>
              <span className="badge badge-secondary">1:N FAISS: {result.timing_ms.search_ms ?? 0}ms</span>
              <span className="badge badge-primary" style={{ fontWeight: 700 }}>
                Total Time: {result.total_processing_time ?? result.timing_ms.total_ms ?? 0}ms
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Authenticate
