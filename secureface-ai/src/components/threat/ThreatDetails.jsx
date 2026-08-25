const riskColors = {
  High: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.18)' },
  Medium: { color: '#ea580c', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.18)' },
  Low: { color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.18)' },
}

function ScoreBar({ label, value, color }) {
  return (
    <div className="threat-score-row">
      <div className="threat-score-label">
        <span>{label}</span>
        <span className="threat-score-value">{value}%</span>
      </div>
      <div className="threat-score-track">
        <div
          className="threat-score-fill"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  )
}

function ThreatDetails({ threat, onClose }) {
  if (!threat) return null

  const risk = riskColors[threat.riskLevel]

  return (
    <>
      <div className="threat-details-overlay" onClick={onClose} id="threat-details-overlay" />
      <div className="threat-details-panel" id="threat-details-panel">
        {/* Header */}
        <div className="threat-details-header">
          <div>
            <span className="threat-details-tag">THREAT DETAILS</span>
            <h3 className="threat-details-title">{threat.type}</h3>
          </div>
          <button className="threat-details-close" onClick={onClose} id="close-details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Risk Score */}
        <div className="threat-details-risk" style={{ background: risk.bg, borderColor: risk.border }}>
          <div className="threat-risk-score-ring" style={{ borderColor: risk.color }}>
            <span className="threat-risk-score-num" style={{ color: risk.color }}>{threat.riskScore}</span>
          </div>
          <div>
            <span className="threat-risk-score-label">Risk Score</span>
            <span className="threat-risk-level" style={{ color: risk.color }}>{threat.riskLevel.toUpperCase()}</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="threat-details-grid">
          <div className="threat-detail-item">
            <span className="threat-detail-key">Detection Time</span>
            <span className="threat-detail-val">{threat.timestamp}</span>
          </div>
          <div className="threat-detail-item">
            <span className="threat-detail-key">Source</span>
            <span className="threat-detail-val">{threat.source}</span>
          </div>
          <div className="threat-detail-item">
            <span className="threat-detail-key">Status</span>
            <span className={`badge badge-${threat.status === 'Blocked' ? 'danger' : 'info'}`}>
              {threat.status}
            </span>
          </div>
          <div className="threat-detail-item">
            <span className="threat-detail-key">Threat Type</span>
            <span className="threat-detail-val">{threat.type}</span>
          </div>
        </div>

        {/* Description */}
        <div className="threat-details-section">
          <h4>Description</h4>
          <p className="threat-detail-desc">{threat.description}</p>
        </div>

        {/* AI Analysis */}
        <div className="threat-details-section">
          <h4>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
              <path d="M2 12h2" /><path d="M20 12h2" />
              <path d="M12 16v6" /><path d="M8 22h8" />
            </svg>
            AI Analysis
          </h4>
          <div className="threat-scores">
            <ScoreBar label="Face Match" value={threat.faceMatch} color="#2563eb" />
            <ScoreBar label="Liveness Score" value={threat.livenessScore} color="#16a34a" />
            <ScoreBar label="Deepfake Probability" value={threat.deepfakeProbability} color="#dc2626" />
          </div>
        </div>

        {/* Decision */}
        <div className="threat-decision" style={{ background: risk.bg, borderColor: risk.border }}>
          <span className="threat-decision-label">Final Decision</span>
          <span className="threat-decision-value" style={{ color: risk.color }}>
            {threat.status.toUpperCase()}
          </span>
        </div>
      </div>
    </>
  )
}

export default ThreatDetails
