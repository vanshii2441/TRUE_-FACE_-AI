import { useState, useEffect } from 'react'
import { getUsers, resetUsers } from '../services/api'

function formatDate(isoString) {
  if (!isoString) return 'N/A'
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

function Users() {
  const [users, setUsers] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resetting, setResetting] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers()
      setUsers(data.users || [])
      setTotalCount(data.total_enrolled || 0)
    } catch (err) {
      setError(err.message || 'Failed to fetch enrolled users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset the FAISS vector database? All enrolled face vectors will be deleted.')) {
      return
    }

    setResetting(true)
    try {
      await resetUsers()
      await fetchUsers()
    } catch (err) {
      alert('Failed to reset vector database: ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Registered Users</h1>
          <p>
            View all identities enrolled in the FAISS 1:N vector index database.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchUsers} disabled={loading}>
            Refresh
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleReset} disabled={resetting || users.length === 0} style={{ background: '#ef4444', color: '#fff' }}>
            {resetting ? 'Resetting...' : 'Reset Vector DB'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid-3 mb-24">
        <div className="stat-card animate-in animate-delay-1">
          <div className="card-icon primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">Total Enrolled Vectors</div>
            <div className="stat-value">{totalCount}</div>
          </div>
        </div>

        <div className="stat-card animate-in animate-delay-2">
          <div className="card-icon success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">FAISS Vector Index</div>
            <div className="stat-value">512d L2</div>
          </div>
        </div>

        <div className="stat-card animate-in animate-delay-3">
          <div className="card-icon warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">Anti-Spoofing Status</div>
            <div className="stat-value" style={{ color: '#10b981' }}>Active</div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="section-title">Identity Database Records</div>
      
      {loading ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading enrolled user records from FastAPI backend...
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '24px', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
          ⚠️ {error}
        </div>
      ) : users.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', fontWeight: 500 }}>
            No enrolled users found in the FAISS database.
          </p>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '6px' }}>
            Go to the "Register" tab to enroll new users with face photos.
          </p>
        </div>
      ) : (
        <div className="table-container animate-in animate-delay-2" id="users-table">
          <table className="table">
            <thead>
              <tr>
                <th>FAISS ID</th>
                <th>User ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Enrolled Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.faiss_id || user.user_id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      #{user.faiss_id}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                      {user.user_id}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {user.name}
                  </td>
                  <td>
                    <span className="badge badge-success">
                      <span className="status-dot online" style={{ width: '6px', height: '6px' }} />
                      Enrolled & Active
                    </span>
                  </td>
                  <td>{formatDate(user.enrolled_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Users
