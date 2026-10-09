import { useState, useEffect, useCallback } from 'react'
import ThreatSummaryCard from '../components/threat/ThreatSummaryCard'
import ThreatTable from '../components/threat/ThreatTable'
import ThreatDetails from '../components/threat/ThreatDetails'
import ThreatDistribution from '../components/threat/ThreatDistribution'
import ThreatTrendChart from '../components/threat/ThreatTrendChart'
import SecurityAlert from '../components/threat/SecurityAlert'
import ThreatSources from '../components/threat/ThreatSources'
import { getVerificationHistory } from '../services/api'

function mapDecisionToThreat(log, idx) {
  const ts = log.timestamp ? new Date(log.timestamp) : new Date()
  const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const fullTimeStr = ts.toLocaleTimeString()

  let threatType = 'Unknown Attempt'
  let riskLevel = 'Low'
  let status = log.is_authenticated ? 'Allowed' : 'Blocked'

  switch (log.final_decision) {
    case 'DEEPFAKE_SUSPECTED':
      threatType = 'AI Deepfake'
      riskLevel = 'High'
      status = 'Blocked'
      break
    case 'LIVENESS_FAILED':
      threatType = 'Photo Spoof'
      riskLevel = 'High'
      status = 'Blocked'
      break
    case 'POOR_QUALITY':
      threatType = 'Low Quality'
      riskLevel = 'Medium'
      status = 'Blocked'
      break
    case 'MULTIPLE_FACES':
      threatType = 'Multiple Faces'
      riskLevel = 'Medium'
      status = 'Blocked'
      break
    case 'NO_FACE':
      threatType = 'No Face'
      riskLevel = 'Low'
      status = 'Logged'
      break
    case 'UNKNOWN_PERSON':
      threatType = 'Unknown Person'
      riskLevel = 'Low'
      status = 'Logged'
      break
    case 'MODEL_UNAVAILABLE':
      threatType = 'Model Unavailable'
      riskLevel = 'Medium'
      status = 'Blocked'
      break
    case 'AUTHENTICATED':
      threatType = 'Authenticated User'
      riskLevel = 'Low'
      status = 'Allowed'
      break
    default:
      threatType = log.final_decision || 'Verification Attempt'
      riskLevel = log.is_authenticated ? 'Low' : 'Medium'
      status = log.is_authenticated ? 'Allowed' : 'Blocked'
  }

  const faceMatch = Math.round((log.similarity_score || 0) * 100)
  const livenessScore = Math.round((log.liveness_score || 0) * 100)
  const deepfakeProbability = Math.round((log.deepfake_probability || 0) * 100)
  const riskScore = Math.min(100, Math.max(0, 100 - faceMatch))

  return {
    id: log.id || idx + 1,
    time: timeStr,
    timestamp: fullTimeStr,
    type: threatType,
    source: log.identity || (log.user_id ? `User ${log.user_id}` : 'Terminal 01'),
    riskLevel,
    status,
    riskScore,
    faceMatch,
    livenessScore,
    deepfakeProbability,
    description: log.explanation || 'Biometric verification attempt recorded in backend audit log.',
    rawLog: log,
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

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getVerificationHistory(500)
      const mapped = (data.history || []).map(mapDecisionToThreat)
      setThreats(mapped)
    } catch (err) {
      console.error('Error fetching threat audit history:', err)
      setError('Failed to fetch verification audit logs from backend server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleExport = () => {
    setShowExportToast(true)
    setTimeout(() => setShowExportToast(false), 3000)
  }

  const handleAlertView = (alert) => {
    const match = threats.find(
      (t) => t.time === alert.time && t.source === alert.source
    )
    if (match) setSelectedThreat(match)
  }

  // Compute live threat summary
  const highCount = threats.filter((t) => t.riskLevel === 'High').length
  const mediumCount = threats.filter((t) => t.riskLevel === 'Medium').length
  const lowCount = threats.filter((t) => t.riskLevel === 'Low').length
  const totalCount = threats.length

  const threatSummary = {
    high: { count: highCount, delta: `${highCount} recorded` },
    medium: { count: mediumCount, delta: `${mediumCount} recorded` },
    low: { count: lowCount, delta: `${lowCount} recorded` },
    total: { count: totalCount, delta: `${totalCount} total events` },
  }

  const distributionData = [
    { label: 'High Risk', count: highCount, color: '#dc2626', bgColor: 'rgba(220,38,38,0.08)' },
    { label: 'Medium Risk', count: mediumCount, color: '#ea580c', bgColor: 'rgba(234,88,12,0.08)' },
    { label: 'Low Risk', count: lowCount, color: '#16a34a', bgColor: 'rgba(22,163,74,0.08)' },
  ]

  // Compute alerts from high & medium risk items
  const alerts = threats
    .filter((t) => t.riskLevel === 'High' || t.riskLevel === 'Medium')
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      riskLevel: t.riskLevel,
      title: `${t.type} Attempt`,
      source: t.source,
      time: t.time,
    }))

  // Compute threat sources breakdown
  const sourceCounts = {}
  threats.forEach((t) => {
    sourceCounts[t.source] = (sourceCounts[t.source] || 0) + 1
  })
  const threatSources = Object.entries(sourceCounts)
    .map(([name, count]) => ({ name, count, max: Math.max(10, count) }))
    .slice(0, 5)

  // Compute trend data
  const trendData = {
    today: [
      { label: 'Events', value: totalCount },
    ],
    week: [
      { label: 'Current', value: totalCount },
    ],
    month: [
      { label: 'Total', value: totalCount },
    ],
  }

  return (
    <div className="animate-in threat-monitor-page">
      {/* Page Header */}
      <div className="threat-page-header">
        <div className="threat-header-left">
          <h1>
            <span className="gradient-text">Threat Monitor</span>
          </h1>
          <p>Monitor and analyze real-time biometric security events from backend audit logs.</p>
        </div>
        <div className="threat-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchLogs}
            disabled={loading}
            id="header-refresh-btn"
          >
            🔄 {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() =>
              setActiveFilter((prev) => {
                const cycle = ['All', 'High', 'Medium', 'Low']
                const idx = cycle.indexOf(prev)
                return cycle[(idx + 1) % cycle.length]
              })
            }
            id="header-filter-btn"
          >
            Filter ({activeFilter})
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExport} id="header-export-btn">
            Export
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', marginBottom: '24px' }}>
          ⚠️ {error}
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

      {/* Threat Table or Empty State */}
      <div className="mb-24">
        {loading ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Checking backend threat logs...
          </div>
        ) : threats.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h3>No verification records available.</h3>
            <p style={{ fontSize: 'var(--font-xs)', marginTop: '8px' }}>
              Perform face verification attempts to record genuine security events in the audit log.
            </p>
          </div>
        ) : (
          <ThreatTable
            threats={threats}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onSelectThreat={setSelectedThreat}
            selectedThreatId={selectedThreat?.id}
          />
        )}
      </div>

      {/* Analytics Section */}
      <div className="threat-analytics-heading">
        <div>
          <h2>Security Analytics</h2>
          <p>Analyze real threat patterns and security activity.</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="threat-charts-row mb-24">
        <ThreatDistribution data={distributionData} />
        <ThreatTrendChart
          data={trendData[trendRange]}
          activeRange={trendRange}
          onRangeChange={setTrendRange}
        />
      </div>

      {/* Alerts & Sources Row */}
      <div className="threat-bottom-row">
        <SecurityAlert alerts={alerts} onViewDetails={handleAlertView} />
        <ThreatSources sources={threatSources} />
      </div>

      {/* Threat Details Panel */}
      <ThreatDetails
        threat={selectedThreat}
        onClose={() => setSelectedThreat(null)}
      />

      {/* Export Toast */}
      {showExportToast && (
        <div className="threat-toast" id="export-toast">
          Threat report exported successfully
        </div>
      )}
    </div>
  )
}

export default ThreatMonitor
