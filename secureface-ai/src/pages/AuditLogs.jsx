import { useState, useEffect, useCallback } from 'react'
import { getPaginatedAuditLogs, clearVerificationHistory } from '../services/api'

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
      setError('Failed to fetch verification audit logs.')
    } finally {
      setLoading(false)
    }
  }, [search, resultFilter, startDate, endDate, page, pageSize])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to permanently clear all verification audit logs?')) return
    try {
      await clearVerificationHistory()
      fetchLogs()
    } catch (err) {
      alert(err.message || 'Failed to clear logs.')
    }
  }

  const getDecisionBadge = (decision, isAuth) => {
    if (isAuth) {
      return <span className="badge badge-success">✅ {decision}</span>
    }
    switch (decision) {
      case 'DEEPFAKE_SUSPECTED':
        return <span className="badge badge-purple">⚠️ {decision}</span>
      case 'UNKNOWN_PERSON':
        return <span className="badge badge-warning">❓ {decision}</span>
      case 'POOR_QUALITY':
        return <span className="badge badge-warning">📷 {decision}</span>
      default:
        return <span className="badge badge-danger">❌ {decision}</span>
    }
  }

  return (
    <div className="animate-in" style={{ paddingBottom: '40px' }}>
      <div className="page-header">
        <h1>Security Verification Audit Logs</h1>
        <p>
          Secure audit trail capturing all identity verification events, presentation attacks, deepfake detections, and system latency.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="card mb-24">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
          {/* Search Box */}
          <div>
            <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Search Identity / ID
            </label>
            <input
              type="text"
              className="input"
              placeholder="Search name, user ID, decision..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              id="audit-search-input"
            />
          </div>

          {/* Result Status Filter */}
          <div>
            <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Decision Filter
            </label>
            <select
              className="input"
              value={resultFilter}
              onChange={(e) => {
                setResultFilter(e.target.value)
                setPage(1)
              }}
              id="audit-filter-select"
            >
              <option value="ALL">All Decisions</option>
              <option value="AUTHENTICATED">AUTHENTICATED</option>
              <option value="UNKNOWN_PERSON">UNKNOWN_PERSON</option>
              <option value="LIVENESS_FAILED">LIVENESS_FAILED</option>
              <option value="DEEPFAKE_SUSPECTED">DEEPFAKE_SUSPECTED</option>
              <option value="POOR_QUALITY">POOR_QUALITY</option>
              <option value="NO_FACE">NO_FACE</option>
              <option value="MULTIPLE_FACES">MULTIPLE_FACES</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Start Date
            </label>
            <input
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
          <div>
            <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              End Date
            </label>
            <input
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

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            Showing {logs.length} of {totalCount} matching audit log records
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchLogs} disabled={loading}>
              🔄 Refresh
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleClearAll} style={{ color: '#ef4444' }}>
              🗑 Clear Logs
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="card mb-24">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading audit records...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No audit log records match the selected criteria.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Timestamp</th>
                  <th>Decision Result</th>
                  <th>Identified Person</th>
                  <th>Similarity</th>
                  <th>Liveness</th>
                  <th>Deepfake Prob</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                      #{log.id}
                    </td>
                    <td style={{ fontSize: 'var(--font-xs)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>{getDecisionBadge(log.final_decision, log.is_authenticated)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.identity || 'Unauthenticated'}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {((log.similarity_score || 0) * 100).toFixed(1)}%
                    </td>
                    <td style={{ color: log.liveness_status === 'SPOOF' ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                      {((log.liveness_score || 0) * 100).toFixed(1)}% ({log.liveness_status || 'REAL'})
                    </td>
                    <td style={{ color: log.deepfake_status === 'DEEPFAKE' ? '#8b5cf6' : '#10b981', fontWeight: 600 }}>
                      {((log.deepfake_probability || 0) * 100).toFixed(1)}% ({log.deepfake_status || 'REAL'})
                    </td>
                    <td style={{ fontSize: 'var(--font-xs)', color: 'var(--primary)' }}>
                      {log.timing_ms?.total_ms || 0} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              ◀ Previous
            </button>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next ▶
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuditLogs
