import { useState, useEffect, useCallback, useMemo } from 'react'
import ThreatSummaryCard from '../components/threat/ThreatSummaryCard'
import ThreatTable from '../components/threat/ThreatTable'
import ThreatDetails from '../components/threat/ThreatDetails'
import ThreatDistribution from '../components/threat/ThreatDistribution'
import ThreatTrendChart from '../components/threat/ThreatTrendChart'
import SecurityAlert from '../components/threat/SecurityAlert'
import ThreatSources from '../components/threat/ThreatSources'
import { getVerificationHistory, clearVerificationHistory } from '../services/api'
import Breadcrumb from '../components/Breadcrumb'

function mapDecisionToThreat(log, idx) {
  let timeStr = 'N/A'
  let fullTimeStr = 'N/A'
  let rawDate = null

  if (log.timestamp) {
    const ts = new Date(log.timestamp)
    if (!isNaN(ts.getTime())) {
      rawDate = ts
      timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const datePart = ts.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      const timePart = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      fullTimeStr = `${datePart} ${timePart}`
    }
  }

  let threatType = 'Verification Attempt'
  let riskLevel = 'Low'
  let status = log.is_authenticated ? 'Allowed' : 'Blocked'

  switch (log.final_decision) {
    case 'DEEPFAKE_SUSPECTED':
      threatType = 'AI Deepfake Attempt'
      riskLevel = 'High'
      status = 'Blocked'
      break
    case 'LIVENESS_FAILED':
      threatType = 'Photo/Replay Spoof'
      riskLevel = 'High'
      status = 'Blocked'
      break
    case 'POOR_QUALITY':
      threatType = 'Low Quality Image'
      riskLevel = 'Medium'
      status = 'Blocked'
      break
    case 'MULTIPLE_FACES':
      threatType = 'Multiple Faces Detected'
      riskLevel = 'Medium'
      status = 'Blocked'
      break
    case 'NO_FACE':
      threatType = 'No Face Detected'
      riskLevel = 'Low'
      status = 'Logged'
      break
    case 'EMPTY_DATABASE':
      threatType = 'Empty Gallery Attempt'
      riskLevel = 'Medium'
      status = 'Blocked'
      break
    case 'UNKNOWN_PERSON':
      threatType = 'Unregistered Identity'
      riskLevel = 'Low'
      status = 'Logged'
      break
    case 'MODEL_UNAVAILABLE':
      threatType = 'Model Degraded / Offline'
      riskLevel = 'Medium'
      status = 'Blocked'
      break
    case 'AUTHENTICATED':
      threatType = 'Verified Identity'
      riskLevel = 'Low'
      status = 'Allowed'
      break
    default:
      threatType = log.final_decision ? log.final_decision.replace(/_/g, ' ') : 'Verification Attempt'
      riskLevel = log.is_authenticated ? 'Low' : 'Medium'
      status = log.is_authenticated ? 'Allowed' : 'Blocked'
  }

  // Real source attribution: never hardcode fake terminals like 'Perimeter Terminal 01'
  let sourceName = 'Unauthenticated Subject'
  if (log.identity && log.identity !== 'Unauthenticated') {
    sourceName = log.identity
  } else if (log.user_id) {
    sourceName = `User ${log.user_id}`
  }

  const faceMatch = typeof log.similarity_score === 'number' && !isNaN(log.similarity_score)
    ? Math.round(log.similarity_score * 100)
    : null
  const livenessScore = typeof log.liveness_score === 'number' && !isNaN(log.liveness_score)
    ? Math.round(log.liveness_score * 100)
    : null
  const deepfakeProbability = typeof log.deepfake_probability === 'number' && !isNaN(log.deepfake_probability)
    ? Math.round(log.deepfake_probability * 100)
    : null
  const qualityScore = typeof log.quality_score === 'number' && !isNaN(log.quality_score)
    ? Math.round(log.quality_score * 100)
    : null

  const riskScore = faceMatch !== null ? Math.min(100, Math.max(0, 100 - faceMatch)) : 0

  return {
    id: log.id || `evt-${idx + 1}`,
    time: timeStr,
    timestamp: fullTimeStr,
    rawTimestamp: rawDate,
    type: threatType,
    source: sourceName,
    riskLevel,
    status,
    riskScore,
    faceMatch,
    livenessScore,
    deepfakeProbability,
    qualityScore,
    description: log.explanation || 'Verification decision logged by backend recognition pipeline.',
    rawLog: log,
  }
}

function computeTrendData(threatsList) {
  const todayBuckets = [
    { label: '00-04h', value: 0 },
    { label: '04-08h', value: 0 },
    { label: '08-12h', value: 0 },
    { label: '12-16h', value: 0 },
    { label: '16-20h', value: 0 },
    { label: '20-24h', value: 0 },
  ]

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekMap = {}
  const weekLabels = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayName = daysOfWeek[d.getDay()]
    const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    weekMap[key] = { label: `${dayName} (${dateFormatted})`, value: 0 }
    weekLabels.push(key)
  }

  const monthBuckets = [
    { label: 'Week 1', value: 0 },
    { label: 'Week 2', value: 0 },
    { label: 'Week 3', value: 0 },
    { label: 'Week 4', value: 0 },
  ]

  threatsList.forEach((t) => {
    const rawDate = t.rawTimestamp
    if (!rawDate || isNaN(rawDate.getTime())) return

    const hour = rawDate.getHours()
    const slot = Math.min(5, Math.floor(hour / 4))
    if (todayBuckets[slot]) {
      todayBuckets[slot].value += 1
    }

    const key = `${rawDate.getFullYear()}-${rawDate.getMonth()}-${rawDate.getDate()}`
    if (weekMap[key]) {
      weekMap[key].value += 1
    }

    const dayOfMonth = rawDate.getDate()
    const weekIndex = Math.min(3, Math.floor((dayOfMonth - 1) / 7))
    monthBuckets[weekIndex].value += 1
  })

  return {
    today: todayBuckets,
    week: weekLabels.map((k) => weekMap[k]),
    month: monthBuckets,
  }
}

function ThreatMonitor() {
  const [threats, setThreats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedThreat, setSelectedThreat] = useState(null)
  const [activeFilter, setActiveFilter] = useState('All')
  const [trendRange, setTrendRange] = useState('today')
  const [showExportToast, setShowExportToast] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  const [isClearing, setIsClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const data = await getVerificationHistory(500)
      const rawLogs = data.history || []

      // Deduplicate by ID and timestamp to guard against repeated burst records
      const seen = new Set()
      const uniqueLogs = []
      for (const log of rawLogs) {
        const uniqueKey = log.id || `${log.timestamp}_${log.final_decision}_${log.identity || ''}`
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey)
          uniqueLogs.push(log)
        }
      }

      const mapped = uniqueLogs.map(mapDecisionToThreat)
      setThreats(mapped)
      setLastRefreshedAt(new Date())
    } catch (err) {
      console.error('Error fetching threat audit history:', err)
      setError('Failed to fetch biometric verification audit logs from backend server.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Polling for live threat detection
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetchLogs(true)
    }, 15000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  const handleClearHistory = async () => {
    setIsClearing(true)
    try {
      await clearVerificationHistory()
      setShowClearConfirm(false)
      setExportMessage('Verification audit logs cleared from backend store.')
      setShowExportToast(true)
      setTimeout(() => setShowExportToast(false), 3000)
      await fetchLogs(false)
    } catch (err) {
      console.error('Failed to clear audit history:', err)
      setError('Failed to clear verification history. Check backend service.')
    } finally {
      setIsClearing(false)
    }
  }

  const handleExportCsv = () => {
    if (threats.length === 0) {
      setExportMessage('No threat logs available to export.')
      setShowExportToast(true)
      setTimeout(() => setShowExportToast(false), 3000)
      return
    }

    const headers = [
      'Incident ID',
      'Timestamp',
      'Threat Type',
      'Risk Level',
      'Final Status',
      'Source / Identity',
      'Face Match (%)',
      'Liveness Score (%)',
      'Deepfake Probability (%)',
      'Quality Score (%)',
      'Explanation'
    ]

    const csvRows = threats.map((t) => [
      `"${t.id}"`,
      `"${t.timestamp}"`,
      `"${t.type}"`,
      `"${t.riskLevel}"`,
      `"${t.status}"`,
      `"${t.source}"`,
      t.faceMatch !== null ? t.faceMatch : 'N/A',
      t.livenessScore !== null ? t.livenessScore : 'N/A',
      t.deepfakeProbability !== null ? t.deepfakeProbability : 'N/A',
      t.qualityScore !== null ? t.qualityScore : 'N/A',
      `"${(t.description || '').replace(/"/g, '""')}"`
    ])

    const csvContent = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    link.href = url
    link.setAttribute('download', `trueface_threat_audit_${timestampStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setExportMessage(`Exported ${threats.length} threat incidents to CSV successfully.`)
    setShowExportToast(true)
    setTimeout(() => setShowExportToast(false), 3500)
  }

  // Functional View Details link handler
  const handleAlertView = (alert) => {
    if (alert.rawThreat) {
      setSelectedThreat(alert.rawThreat)
      return
    }
    const match = threats.find((t) => t.id === alert.id)
    if (match) setSelectedThreat(match)
  }

  // Compute live threat summary metrics
  const highCount = threats.filter((t) => t.riskLevel === 'High').length
  const mediumCount = threats.filter((t) => t.riskLevel === 'Medium').length
  const lowCount = threats.filter((t) => t.riskLevel === 'Low').length
  const totalCount = threats.length

  const threatSummary = {
    high: { count: highCount, delta: totalCount > 0 ? `${highCount} flagged` : 'N/A' },
    medium: { count: mediumCount, delta: totalCount > 0 ? `${mediumCount} monitored` : 'N/A' },
    low: { count: lowCount, delta: totalCount > 0 ? `${lowCount} standard` : 'N/A' },
    total: { count: totalCount, delta: totalCount > 0 ? `${totalCount} total events` : 'N/A' },
  }

  const distributionData = [
    { label: 'High Risk', count: highCount, color: '#dc2626', bgColor: 'rgba(220,38,38,0.08)' },
    { label: 'Medium Risk', count: mediumCount, color: '#ea580c', bgColor: 'rgba(234,88,12,0.08)' },
    { label: 'Low Risk', count: lowCount, color: '#16a34a', bgColor: 'rgba(22,163,74,0.08)' },
  ]

  // Top alerts from high & medium incidents
  const alerts = useMemo(() => {
    return threats
      .filter((t) => t.riskLevel === 'High' || t.riskLevel === 'Medium')
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        riskLevel: t.riskLevel,
        title: `${t.type}`,
        source: t.source,
        time: t.time,
        rawThreat: t,
      }))
  }, [threats])

  // Real threat sources: strictly aggregate actual threats (Blocked or High/Medium risk), NEVER legitimate users
  const threatSources = useMemo(() => {
    const sourceCounts = {}
    threats
      .filter((t) => t.status === 'Blocked' || t.riskLevel === 'High' || t.riskLevel === 'Medium')
      .forEach((t) => {
        const src = t.source || 'Unauthenticated Subject'
        sourceCounts[src] = (sourceCounts[src] || 0) + 1
      })
    const entries = Object.entries(sourceCounts)
    const maxVal = Math.max(1, ...Object.values(sourceCounts))
    return entries
      .map(([name, count]) => ({ name, count, max: maxVal }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [threats])

  // Real multi-bar trend calculations
  const trendData = useMemo(() => {
    return computeTrendData(threats)
  }, [threats])

  return (
    <div className="threat-container animate-in">
      <Breadcrumb items={[{ label: 'Threat Monitor' }]} />

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title">Biometric Threat Monitor</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
              Live Telemetry
            </span>
          </div>
          <p className="page-subtitle">
            Surveillance of presentation attacks, synthetic deepfakes, and perimeter verification incidents.
          </p>
        </div>
        <div className="header-actions-group">
          {/* Live Auto-Refresh Toggle */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Click to pause auto-polling' : 'Click to enable live auto-polling'}
            id="threat-auto-refresh-toggle"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: autoRefresh ? '#10b981' : '#6b7280',
                display: 'inline-block',
                boxShadow: autoRefresh ? '0 0 8px #10b981' : 'none'
              }}
            />
            <span>{autoRefresh ? 'Live Auto (15s)' : 'Live Paused'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchLogs(false)}
            disabled={loading}
            id="header-refresh-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`btn-icon ${loading ? 'spin' : ''}`}>
              <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          {threats.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowClearConfirm(true)}
              disabled={isClearing}
              id="header-clear-btn"
              title="Clear all recorded verification logs from backend store"
              style={{ color: 'var(--danger)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Clear Logs
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleExportCsv}
            disabled={threats.length === 0}
            id="header-export-btn"
            title="Download complete incident logs as CSV"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Logs (CSV)
          </button>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-backdrop animate-in" onClick={() => setShowClearConfirm(false)}>
          <div className="card modal-card-sm" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Clear Verification History?</h3>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              This will remove all stored verification audit records from the backend database. You can start fresh with real authentication events.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleClearHistory}
                disabled={isClearing}
                id="confirm-clear-logs-btn"
              >
                {isClearing ? 'Clearing...' : 'Yes, Clear Logs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner with Retry */}
      {error && (
        <div className="alert-banner alert-danger mb-20" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => fetchLogs(false)}
            style={{ marginLeft: '12px' }}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="threat-summary-grid mb-24">
        <ThreatSummaryCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          }
          label="High Risk"
          value={threatSummary.high.count}
          delta={threatSummary.high.delta}
          colorClass="danger"
        />
        <ThreatSummaryCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
          label="Medium Risk"
          value={threatSummary.medium.count}
          delta={threatSummary.medium.delta}
          colorClass="warning"
        />
        <ThreatSummaryCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          label="Low Risk"
          value={threatSummary.low.count}
          delta={threatSummary.low.delta}
          colorClass="success"
        />
        <ThreatSummaryCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
          label="Total Threats"
          value={threatSummary.total.count}
          delta={threatSummary.total.delta}
          colorClass="info"
        />
      </div>

      {/* Main Table or Loading / Empty States */}
      <div className="mb-24">
        {loading && threats.length === 0 ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ display: 'inline-block', marginBottom: '12px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin" style={{ width: 32, height: 32, color: 'var(--primary)' }}>
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
              </svg>
            </div>
            <p style={{ fontWeight: 600 }}>Connecting to backend threat telemetry API...</p>
            <p style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>Querying /api/v1/history</p>
          </div>
        ) : threats.length === 0 ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(37,99,235,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', color: 'var(--primary)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '6px' }}>No Verification Records Available</h3>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 16px', lineHeight: 1.5 }}>
              No biometric face verification attempts are currently recorded in the backend audit store. Go to the Authenticate page to test real-time face verification.
            </p>
            <a href="/authenticate" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Go to Verify Identity
            </a>
          </div>
        ) : (
          <ThreatTable
            threats={threats}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onSelectThreat={setSelectedThreat}
            selectedThreatId={selectedThreat?.id}
            riskCounts={{
              all: totalCount,
              high: highCount,
              medium: mediumCount,
              low: lowCount,
            }}
          />
        )}
      </div>

      {/* Analytics Section */}
      <div className="threat-analytics-heading">
        <div>
          <h2>Security Analytics & Behavioral Telemetry</h2>
          <p>Real-time distribution, incident frequency, and attack source analysis.</p>
        </div>
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
          {lastRefreshedAt ? `Telemetry synced: ${lastRefreshedAt.toLocaleTimeString()}` : 'Telemetry synced: N/A'}
        </div>
      </div>

      {/* Charts Row */}
      <div className="threat-charts-row mb-24">
        <ThreatDistribution data={distributionData} />
        <ThreatTrendChart
          data={trendData[trendRange] || []}
          activeRange={trendRange}
          onRangeChange={setTrendRange}
        />
      </div>

      {/* Alerts & Sources Row */}
      <div className="threat-bottom-row">
        <SecurityAlert alerts={alerts} onViewDetails={handleAlertView} />
        <ThreatSources sources={threatSources} />
      </div>

      {/* Threat Details Sliding Drawer */}
      <ThreatDetails
        threat={selectedThreat}
        onClose={() => setSelectedThreat(null)}
      />

      {/* Export Toast Notification */}
      {showExportToast && (
        <div className="threat-toast" id="export-toast">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>{exportMessage}</span>
        </div>
      )}
    </div>
  )
}

export default ThreatMonitor
