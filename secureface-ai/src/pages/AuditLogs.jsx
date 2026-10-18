import { useState, useEffect, useCallback } from 'react'
import { getPaginatedAuditLogs, clearVerificationHistory } from '../services/api'
import Breadcrumb from '../components/Breadcrumb'

function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [resultFilter, setResultFilter] = useState('ALL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState(null)
  const [selectedLog, setSelectedLog] = useState(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPaginatedAuditLogs({
        q: search,
        result_filter: resultFilter,
        start_date: startDate ? new Date(startDate).toISOString() : '',
        end_date: endDate ? new Date(endDate).toISOString() : '',
        page,
        page_size: pageSize,
      })
      setLogs(data.items || [])
      setTotalCount(data.total_count || 0)
      setTotalPages(data.total_pages || 1)
    } catch (err) {
      console.error('Error fetching audit logs:', err)
      setError(err.message || 'Failed to fetch verification audit trail from server.')
    } finally {
      setLoading(false)
    }
  }, [search, resultFilter, startDate, endDate, page, pageSize])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleClearAll = async () => {
    if (!window.confirm('WARNING: Are you sure you want to permanently clear all verification audit history logs?')) return
    try {
      await clearVerificationHistory()
      await fetchLogs()
    } catch (err) {
      alert(`Failed to clear logs: ${err.message}`)
    }
  }

  const handleResetFilters = () => {
    setSearch('')
    setResultFilter('ALL')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const getDecisionBadge = (decision, isAuth) => {
    if (isAuth) {
      return <span className="status-badge badge-success">Verified</span>
    }
    switch (decision) {
      case 'DEEPFAKE_SUSPECTED':
        return <span className="status-badge badge-purple">Deepfake</span>
      case 'LIVENESS_FAILED':
        return <span className="status-badge badge-danger">Spoof</span>
      case 'UNKNOWN_PERSON':
        return <span className="status-badge badge-warning">Unrecognized</span>
      case 'POOR_QUALITY':
        return <span className="status-badge badge-warning">Low Quality</span>
      case 'NO_FACE':
        return <span className="status-badge badge-neutral">No Face</span>
      case 'MULTIPLE_FACES':
        return <span className="status-badge badge-warning">Multiple Faces</span>
      default:
        return <span className="status-badge badge-danger">Rejected</span>
    }
  }

  return (
    <div className="audit-container animate-in">
      <Breadcrumb items={[{ label: 'Audit Logs' }]} />

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Biometric Verification Audit Trail</h1>
          <p className="page-subtitle">
            Immutable security log recording all biometric authentication queries, anti-spoofing evaluations, and match confidence scores.
          </p>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`btn-icon ${loading ? 'spin' : ''}`}>
              <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh Logs'}
          </button>

          {totalCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm danger-text"
              onClick={handleClearAll}
              disabled={loading}
            >
              Clear Log History
            </button>
          )}
        </div>
      </div>

      {/* Filter and Query Control Card */}
      <div className="card mb-24">
        <div className="filter-controls-grid">
          {/* Search Box */}
          <div className="form-group">
            <label className="form-label" htmlFor="audit-search">Search Identity or Explanation</label>
            <div className="search-input-group">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="audit-search"
                type="text"
                className="input search-input"
                placeholder="Search name, user ID, decision..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          {/* Decision Filter */}
          <div className="form-group">
            <label className="form-label" htmlFor="decision-filter">Decision Outcome</label>
            <select
              id="decision-filter"
              className="input"
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">All Outcomes</option>
              <option value="AUTHENTICATED">AUTHENTICATED (Verified)</option>
              <option value="UNKNOWN_PERSON">UNKNOWN_PERSON (Below Threshold)</option>
              <option value="LIVENESS_FAILED">LIVENESS_FAILED (Presentation Attack)</option>
              <option value="DEEPFAKE_SUSPECTED">DEEPFAKE_SUSPECTED (Synthetic Face)</option>
              <option value="POOR_QUALITY">POOR_QUALITY (Blur / Illumination)</option>
              <option value="NO_FACE">NO_FACE (Zero Detections)</option>
              <option value="MULTIPLE_FACES">MULTIPLE_FACES (Multiple Candidates)</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="start-date">From Date</label>
            <input
              id="start-date"
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {/* End Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="end-date">To Date</label>
            <input
              id="end-date"
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        <div className="filter-summary-row mt-16">
          <span className="filter-count-label">
            Showing {logs.length} of {totalCount} total audit records
          </span>

          {(search || resultFilter !== 'ALL' || startDate || endDate) && (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={handleResetFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="alert-banner alert-danger mb-20">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="card mb-24">
        {loading ? (
          <div className="empty-state-box">
            <div className="spin mb-8">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin-icon">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
              </svg>
            </div>
            <p>Loading audit trail records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <h4 className="empty-state-title">No Audit Records Found</h4>
            <p className="empty-state-text">
              {search || resultFilter !== 'ALL' || startDate || endDate
                ? 'No events match your current filter parameters. Try clearing the filter query.'
                : 'No authentication attempts have been recorded yet. Verification queries automatically populate this audit trail.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Timestamp</th>
                  <th>Identified Person</th>
                  <th>Decision</th>
                  <th>Cosine Similarity</th>
                  <th>Liveness Score</th>
                  <th>Deepfake Prob</th>
                  <th>Latency</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="monospace-text text-muted">
                      #{log.id}
                    </td>
                    <td className="timestamp-cell">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                    </td>
                    <td className="identity-cell">
                      <strong>{log.identity || 'Unauthenticated'}</strong>
                      {log.user_id && <span className="user-id-sub">ID: {log.user_id}</span>}
                    </td>
                    <td>{getDecisionBadge(log.final_decision, log.is_authenticated)}</td>
                    <td className="metric-cell">
                      {((log.similarity_score || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="metric-cell">
                      <span className={log.liveness_status === 'SPOOF' ? 'danger-text' : 'success-text'}>
                        {((log.liveness_score || 0) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="metric-cell">
                      <span className={log.deepfake_status === 'DEEPFAKE' ? 'purple-text' : 'text-secondary'}>
                        {((log.deepfake_probability || 0) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="latency-cell">
                      {log.timing_ms?.total_ms ? `${log.timing_ms.total_ms}ms` : 'N/A'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => setSelectedLog(log)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Navigation */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Previous
            </button>
            <span className="pagination-page-indicator">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Audit Detail Modal / Drawer */}
      {selectedLog && (
        <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Verification Event #{selectedLog.id}</h3>
                <span className="modal-subtitle">
                  {selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : 'N/A'}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedLog(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-grid-2 mb-16">
                <div>
                  <span className="detail-label">Decision Outcome</span>
                  <div className="mt-4">{getDecisionBadge(selectedLog.final_decision, selectedLog.is_authenticated)}</div>
                </div>
                <div>
                  <span className="detail-label">Identified Identity</span>
                  <p className="detail-value font-semibold text-primary">{selectedLog.identity || 'Unauthenticated'}</p>
                </div>
              </div>

              <div className="modal-grid-3 mb-16">
                <div>
                  <span className="detail-label">Similarity Score</span>
                  <p className="detail-value">{((selectedLog.similarity_score || 0) * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <span className="detail-label">Liveness Status</span>
                  <p className={`detail-value ${selectedLog.liveness_status === 'SPOOF' ? 'danger-text' : 'success-text'}`}>
                    {((selectedLog.liveness_score || 0) * 100).toFixed(1)}% ({selectedLog.liveness_status || 'REAL'})
                  </p>
                </div>
                <div>
                  <span className="detail-label">Deepfake Status</span>
                  <p className={`detail-value ${selectedLog.deepfake_status === 'DEEPFAKE' ? 'purple-text' : 'success-text'}`}>
                    {((selectedLog.deepfake_probability || 0) * 100).toFixed(1)}% ({selectedLog.deepfake_status || 'REAL'})
                  </p>
                </div>
              </div>

              <div className="detail-box mb-16">
                <span className="detail-label">Decision Engine Explanation</span>
                <p className="detail-explanation-text">
                  {selectedLog.explanation || 'No detailed explanation recorded for this attempt.'}
                </p>
              </div>

              {selectedLog.timing_ms && (
                <div className="detail-box">
                  <span className="detail-label">Pipeline Stage Latency Breakdown</span>
                  <div className="timing-pills-row mt-8">
                    <span className="timing-pill">Detection: <strong>{selectedLog.timing_ms.detection_ms || 0}ms</strong></span>
                    <span className="timing-pill">Quality: <strong>{selectedLog.timing_ms.quality_ms || 0}ms</strong></span>
                    <span className="timing-pill">Liveness: <strong>{selectedLog.timing_ms.liveness_ms || 0}ms</strong></span>
                    <span className="timing-pill">Embedding: <strong>{selectedLog.timing_ms.embedding_ms || 0}ms</strong></span>
                    <span className="timing-pill">FAISS Search: <strong>{selectedLog.timing_ms.search_ms || 0}ms</strong></span>
                    <span className="timing-pill highlight">Total: <strong>{selectedLog.timing_ms.total_ms || 0}ms</strong></span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedLog(null)}
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuditLogs
