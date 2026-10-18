import { useState, useMemo } from 'react'

const threatTypeIcons = {
  'AI Deepfake Attempt': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
      <path d="M2 12h2" /><path d="M20 12h2" />
      <path d="M12 16v6" /><path d="M8 22h8" />
    </svg>
  ),
  'Photo/Replay Spoof': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  'Low Quality Image': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  'Multiple Faces Detected': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  'No Face Detected': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  'Empty Gallery Attempt': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  'Unregistered Identity': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <line x1="18" y1="8" x2="23" y2="13" />
      <line x1="23" y1="8" x2="18" y2="13" />
    </svg>
  ),
  'Model Degraded / Offline': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  'Verified Identity': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
}

const defaultThreatIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const riskColors = {
  High: 'danger',
  Medium: 'warning',
  Low: 'success',
}

const statusColors = {
  Blocked: 'danger',
  Allowed: 'success',
  Logged: 'info',
}

function ThreatTable({
  threats,
  activeFilter,
  onFilterChange,
  onSelectThreat,
  selectedThreatId,
  riskCounts,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filters = [
    { key: 'All', label: 'All Incidents', count: riskCounts?.all ?? threats.length },
    { key: 'High', label: 'High Risk', count: riskCounts?.high ?? 0 },
    { key: 'Medium', label: 'Medium Risk', count: riskCounts?.medium ?? 0 },
    { key: 'Low', label: 'Low Risk', count: riskCounts?.low ?? 0 },
  ]

  // Filter & Search
  const filteredThreats = useMemo(() => {
    return threats.filter((threat) => {
      // Risk filter
      if (activeFilter !== 'All' && threat.riskLevel !== activeFilter) {
        return false
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesType = (threat.type || '').toLowerCase().includes(q)
        const matchesSource = (threat.source || '').toLowerCase().includes(q)
        const matchesId = (threat.id || '').toLowerCase().includes(q)
        const matchesStatus = (threat.status || '').toLowerCase().includes(q)
        const matchesDesc = (threat.description || '').toLowerCase().includes(q)
        return matchesType || matchesSource || matchesId || matchesStatus || matchesDesc
      }
      return true
    })
  }, [threats, activeFilter, searchQuery])

  // Reset to page 1 on filter or search change
  const handleFilterChange = (f) => {
    onFilterChange(f)
    setCurrentPage(1)
  }

  const handleSearchChange = (val) => {
    setSearchQuery(val)
    setCurrentPage(1)
  }

  // Pagination calculation
  const totalItems = filteredThreats.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)
  const paginatedThreats = filteredThreats.slice(startIndex, endIndex)

  return (
    <div className="card threat-table-card" id="threat-table-section">
      {/* Top Header Row: Title & Search */}
      <div className="threat-table-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 className="threat-section-title" style={{ margin: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Perimeter Security Audit Records
          </h3>
          <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
            {totalItems} {totalItems === 1 ? 'record' : 'records'}
          </span>
        </div>

        {/* Search Bar */}
        <div className="threat-table-search-row">
          <div className="threat-search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="threat-search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by identity, incident ID, threat type..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="threat-search-input"
              id="threat-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="threat-search-clear"
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="threat-filter-group-row">
        <div className="threat-filter-group">
          {filters.map((f) => (
            <button
              key={f.key}
              className={`threat-filter-btn ${activeFilter === f.key ? 'active' : ''}`}
              onClick={() => handleFilterChange(f.key)}
              id={`filter-${f.key.toLowerCase()}`}
            >
              <span>{f.label}</span>
              <span className="threat-filter-count-badge">
                {f.count}
              </span>
              {f.key !== 'All' && (
                <span className={`threat-filter-dot ${riskColors[f.key]}`} />
              )}
            </button>
          ))}
        </div>

        {/* Page Size Selector */}
        <div className="threat-page-size-selector">
          <label htmlFor="threat-page-size-select" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            Show:
          </label>
          <select
            id="threat-page-size-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="threat-select-dropdown"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-container threat-table-container">
        <table className="table" id="threat-table">
          <thead>
            <tr>
              <th style={{ width: '130px' }}>Time</th>
              <th>Threat Type</th>
              <th>Identity / Terminal</th>
              <th>Risk Level</th>
              <th>Status</th>
              <th>AI Scores</th>
              <th style={{ textAlign: 'right', width: '110px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedThreats.map((threat) => {
              const isSelected = selectedThreatId === threat.id
              const icon = threatTypeIcons[threat.type] || defaultThreatIcon

              return (
                <tr
                  key={threat.id}
                  className={`threat-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectThreat(threat)}
                  id={`threat-row-${threat.id}`}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full security telemetry & decision details"
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="threat-time">{threat.time}</span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {threat.id}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="threat-type-cell">
                      <span className={`threat-type-icon ${riskColors[threat.riskLevel] || 'info'}`}>
                        {icon}
                      </span>
                      <div>
                        <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>
                          {threat.type}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {threat.description.length > 55 ? `${threat.description.slice(0, 55)}...` : threat.description}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, color: 'var(--text-muted)' }}>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span className="threat-source" style={{ fontWeight: 500 }}>
                        {threat.source}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${riskColors[threat.riskLevel] || 'info'}`}>
                      {threat.riskLevel} Risk
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${statusColors[threat.status] || 'info'}`}>
                      {threat.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', fontSize: '0.6875rem' }}>
                      <span className="ai-score-pill match" title="Face Similarity Score">
                        Match: {threat.faceMatch !== null ? `${threat.faceMatch}%` : 'N/A'}
                      </span>
                      <span className={`ai-score-pill ${threat.livenessScore !== null && threat.livenessScore >= 50 ? 'safe' : 'alert'}`} title="Liveness Realness Score">
                        Live: {threat.livenessScore !== null ? `${threat.livenessScore}%` : 'N/A'}
                      </span>
                      <span className="ai-score-pill deepfake" title="Deepfake Probability">
                        Fake: {threat.deepfakeProbability !== null ? `${threat.deepfakeProbability}%` : 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs threat-details-link-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectThreat(threat)
                      }}
                      id={`view-details-${threat.id}`}
                      title="View complete event telemetry and score breakdown"
                    >
                      View Details →
                    </button>
                  </td>
                </tr>
              )
            })}
            {paginatedThreats.length === 0 && (
              <tr>
                <td colSpan="7" className="threat-empty-row" style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {searchQuery ? (
                      <>
                        <p style={{ fontWeight: 600 }}>No incidents matched "{searchQuery}"</p>
                        <p style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                          Try clearing the search query or changing risk level filters.
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: '12px' }}
                          onClick={() => handleSearchChange('')}
                        >
                          Clear Search
                        </button>
                      </>
                    ) : (
                      <>
                        <p style={{ fontWeight: 600 }}>No threat events recorded for {activeFilter} Risk.</p>
                        <p style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
                          Select 'All Incidents' to inspect full audit history.
                        </p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls Footer */}
      {totalItems > 0 && (
        <div className="threat-pagination-footer">
          <div className="threat-pagination-info">
            Showing <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{startIndex + 1}</span>–
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{endIndex}</span> of{' '}
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{totalItems}</span> incidents
          </div>

          <div className="threat-pagination-controls">
            <button
              type="button"
              className="threat-page-btn"
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              aria-label="First page"
              title="Go to first page"
            >
              «
            </button>
            <button
              type="button"
              className="threat-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
              title="Go to previous page"
            >
              ‹
            </button>

            {/* Render up to 5 page numbers around current */}
            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .filter((page) => {
                if (totalPages <= 5) return true
                if (page === 1 || page === totalPages) return true
                return Math.abs(page - safePage) <= 1
              })
              .map((page, idx, arr) => {
                const prev = arr[idx - 1]
                const showEllipsis = prev && page - prev > 1

                return (
                  <span key={page} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {showEllipsis && <span className="threat-page-ellipsis">…</span>}
                    <button
                      type="button"
                      className={`threat-page-btn ${safePage === page ? 'active' : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  </span>
                )
              })}

            <button
              type="button"
              className="threat-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
              title="Go to next page"
            >
              ›
            </button>
            <button
              type="button"
              className="threat-page-btn"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              aria-label="Last page"
              title="Go to last page"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ThreatTable
