import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

const riskColors = {
  High: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.22)' },
  Medium: { color: '#ea580c', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.22)' },
  Low: { color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.22)' },
}

function ScoreBar({ label, value, color, description }) {
  const isNumber = typeof value === 'number' && !isNaN(value)
  const displayVal = isNumber ? `${value}%` : 'N/A'
  const widthVal = isNumber ? Math.min(100, Math.max(0, value)) : 0

  return (
    <div className="threat-score-row">
      <div className="threat-score-label">
        <span>{label}</span>
        <span className="threat-score-value">{displayVal}</span>
      </div>
      <div className="threat-score-track">
        <div
          className="threat-score-fill"
          style={{ width: `${widthVal}%`, background: isNumber ? color : 'var(--border-color)' }}
        />
      </div>
      {description && (
        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          {description}
        </span>
      )}
    </div>
  )
}

function ThreatDetails({ threat, onClose }) {
  const [copied, setCopied] = useState(false)
  const [showRawJson, setShowRawJson] = useState(false)

  // Escape key support & scroll lock
  useEffect(() => {
    if (!threat) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [threat, onClose])

  if (!threat) return null

  const risk = riskColors[threat.riskLevel] || riskColors.Low
  const timing = threat.rawLog?.timing_ms || {}

  const handleCopyId = (e) => {
    e.stopPropagation()
    if (threat.id) {
      navigator.clipboard.writeText(threat.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return createPortal(
    <>
      <div
        className="threat-details-overlay"
        onClick={onClose}
        id="threat-details-overlay"
        role="presentation"
      />
      <aside
        className="threat-details-panel"
        id="threat-details-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="threat-details-title"
      >
        {/* Drawer Header */}
        <div className="threat-details-header">
          <div>
            <span className="threat-details-tag">PERIMETER INCIDENT TELEMETRY</span>
            <h3 className="threat-details-title" id="threat-details-title">
              {threat.type || 'N/A'}
            </h3>
          </div>
          <button
            type="button"
            className="threat-details-close"
            onClick={onClose}
            id="close-details"
            aria-label="Close threat details panel"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Risk Score Banner */}
        <div className="threat-details-risk" style={{ background: risk.bg, borderColor: risk.border }}>
          <div className="threat-risk-score-ring" style={{ borderColor: risk.color }}>
            <span className="threat-risk-score-num" style={{ color: risk.color }}>
              {threat.riskScore !== null && threat.riskScore !== undefined ? threat.riskScore : 'N/A'}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <span className="threat-risk-score-label">Risk Severity Score</span>
            <span className="threat-risk-level" style={{ color: risk.color }}>
              {threat.riskLevel ? `${threat.riskLevel.toUpperCase()} RISK` : 'N/A'}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
              Computed from facial similarity score and spoofing probability metrics.
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="threat-details-grid">
          <div className="threat-detail-item">
            <span className="threat-detail-key">Incident ID</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="threat-detail-val" style={{ fontFamily: 'monospace' }}>
                {threat.id || 'N/A'}
              </span>
              {threat.id && (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={handleCopyId}
                  style={{ fontSize: '0.6875rem', padding: '2px 6px' }}
                  title="Copy incident UUID"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
          </div>
          <div className="threat-detail-item">
            <span className="threat-detail-key">Detection Time</span>
            <span className="threat-detail-val">{threat.timestamp || 'N/A'}</span>
          </div>
          <div className="threat-detail-item">
            <span className="threat-detail-key">Identity / Source</span>
            <span className="threat-detail-val">{threat.source || 'N/A'}</span>
          </div>
          <div className="threat-detail-item">
            <span className="threat-detail-key">Final Access Status</span>
            <span className={`badge badge-${threat.status === 'Blocked' ? 'danger' : threat.status === 'Allowed' ? 'success' : 'info'}`}>
              {threat.status || 'N/A'}
            </span>
          </div>
        </div>

        {/* Description & Decision Explanation */}
        <div className="threat-details-section">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Decision Analysis
          </h4>
          <p className="threat-detail-desc">{threat.description || 'N/A'}</p>
        </div>

        {/* AI Multimodal Analysis */}
        <div className="threat-details-section">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
              <path d="M2 12h2" /><path d="M20 12h2" />
              <path d="M12 16v6" /><path d="M8 22h8" />
            </svg>
            Multimodal Pipeline Telemetry
          </h4>
          <div className="threat-scores">
            <ScoreBar
              label="Face Similarity Match"
              value={threat.faceMatch}
              color="#2563eb"
              description="Cos-similarity of 512-d FaceNet embedding against enrolled biometric database."
            />
            <ScoreBar
              label="Presentation Liveness Score"
              value={threat.livenessScore}
              color="#16a34a"
              description="Texture gradient & depth reflex probability of a live human subject."
            />
            <ScoreBar
              label="Deepfake Synthesis Probability"
              value={threat.deepfakeProbability}
              color="#dc2626"
              description="Frequency domain artifact analysis detecting GAN/Diffusion manipulation."
            />
          </div>
        </div>

        {/* Decision Engine Latency Breakdown */}
        {Object.keys(timing).length > 0 && (
          <div className="threat-details-section">
            <h4>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Execution Latency Breakdown
            </h4>
            <div className="threat-timing-grid">
              {timing.detection_ms !== undefined && (
                <div className="threat-timing-card">
                  <span className="timing-label">Face Detection</span>
                  <span className="timing-value">{timing.detection_ms.toFixed(1)} ms</span>
                </div>
              )}
              {timing.liveness_ms !== undefined && (
                <div className="threat-timing-card">
                  <span className="timing-label">Liveness Check</span>
                  <span className="timing-value">{timing.liveness_ms.toFixed(1)} ms</span>
                </div>
              )}
              {timing.deepfake_ms !== undefined && (
                <div className="threat-timing-card">
                  <span className="timing-label">Deepfake Model</span>
                  <span className="timing-value">{timing.deepfake_ms.toFixed(1)} ms</span>
                </div>
              )}
              {timing.embedding_ms !== undefined && (
                <div className="threat-timing-card">
                  <span className="timing-label">Vector Embed</span>
                  <span className="timing-value">{timing.embedding_ms.toFixed(1)} ms</span>
                </div>
              )}
              {timing.total_ms !== undefined && (
                <div className="threat-timing-card highlight">
                  <span className="timing-label">Total Pipeline</span>
                  <span className="timing-value">{timing.total_ms.toFixed(1)} ms</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Raw Telemetry JSON Toggle */}
        <div className="threat-details-section">
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => setShowRawJson(!showRawJson)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>{showRawJson ? 'Hide Raw Audit JSON' : 'View Raw Audit JSON'}</span>
          </button>

          {showRawJson && (
            <pre className="threat-raw-json-block">
              {JSON.stringify(threat.rawLog, null, 2)}
            </pre>
          )}
        </div>

        {/* Decision Footer */}
        <div className="threat-decision" style={{ background: risk.bg, borderColor: risk.border, marginTop: '20px' }}>
          <span className="threat-decision-label">Pipeline Enforcement</span>
          <span className="threat-decision-value" style={{ color: risk.color }}>
            {threat.status ? threat.status.toUpperCase() : 'N/A'}
          </span>
        </div>
      </aside>
    </>,
    document.body
  )
}

export default ThreatDetails
