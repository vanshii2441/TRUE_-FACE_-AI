const threatTypeIcons = {
  'AI Deepfake': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
      <path d="M2 12h2" /><path d="M20 12h2" />
      <path d="M12 16v6" /><path d="M8 22h8" />
    </svg>
  ),
  'Photo Spoof': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  'Video Replay': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  'Unknown Person': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  '3D Mask': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
  ),
}

const riskColors = {
  High: 'danger',
  Medium: 'warning',
  Low: 'success',
}

const statusColors = {
  Blocked: 'danger',
  Logged: 'info',
}

function ThreatTable({ threats, activeFilter, onFilterChange, onSelectThreat, selectedThreatId }) {
  const filters = ['All', 'High', 'Medium', 'Low']

  const filtered = activeFilter === 'All'
    ? threats
    : threats.filter((t) => t.riskLevel === activeFilter)

  return (
    <div className="card threat-table-card" id="threat-table-section">
      <div className="threat-table-header">
        <h3 className="threat-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Recent Threats
        </h3>
        <div className="threat-filter-group">
          {filters.map((f) => (
            <button
              key={f}
              className={`threat-filter-btn ${activeFilter === f ? 'active' : ''}`}
              onClick={() => onFilterChange(f)}
              id={`filter-${f.toLowerCase()}`}
            >
              {f}
              {f !== 'All' && (
                <span className={`threat-filter-dot ${riskColors[f]}`} />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="table-container threat-table-container">
        <table className="table" id="threat-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Threat Type</th>
              <th>Source</th>
              <th>Risk Level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((threat) => (
              <tr
                key={threat.id}
                className={`threat-row ${selectedThreatId === threat.id ? 'selected' : ''}`}
                onClick={() => onSelectThreat(threat)}
                id={`threat-row-${threat.id}`}
              >
                <td>
                  <span className="threat-time">{threat.time}</span>
                </td>
                <td>
                  <div className="threat-type-cell">
                    <span className={`threat-type-icon ${riskColors[threat.riskLevel]}`}>
                      {threatTypeIcons[threat.type]}
                    </span>
                    <span>{threat.type}</span>
                  </div>
                </td>
                <td>
                  <span className="threat-source">{threat.source}</span>
                </td>
                <td>
                  <span className={`badge badge-${riskColors[threat.riskLevel]}`}>
                    {threat.riskLevel}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${statusColors[threat.status]}`}>
                    {threat.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="5" className="threat-empty-row">
                  No threats found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ThreatTable
