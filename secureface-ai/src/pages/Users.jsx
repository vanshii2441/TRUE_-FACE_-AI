import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getUsers, resetUsers, deleteUser } from '../services/api'
import Breadcrumb from '../components/Breadcrumb'

function formatDate(isoString) {
  if (!isoString) return 'N/A'
  try {
    return new Date(isoString).toLocaleString('en-US', {
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
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [actionMessage, setActionMessage] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers()
      setUsers(data.users || [])
      setTotalCount(data.total_enrolled ?? (data.users || []).length)
    } catch (err) {
      setError(err.message || 'Failed to fetch enrolled identities from vector database.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleDeleteUser = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to delete enrolled identity "${name}" (${userId})? This will remove their 512d biometric vector from FAISS.`)) {
      return
    }

    setDeletingId(userId)
    setActionMessage(null)
    try {
      await deleteUser(userId)
      setActionMessage(`Identity "${name}" (${userId}) was deleted successfully.`)
      setTimeout(() => setActionMessage(null), 4000)
      await fetchUsers()
    } catch (err) {
      alert(`Failed to delete user: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleReset = async () => {
    if (
      !window.confirm(
        'WARNING: Are you sure you want to reset the FAISS vector database? All enrolled face vectors and identity records will be permanently erased.'
      )
    ) {
      return
    }

    setResetting(true)
    setActionMessage(null)
    try {
      await resetUsers()
      setActionMessage('Vector store cleared successfully. All enrolled vectors removed.')
      setTimeout(() => setActionMessage(null), 4000)
      await fetchUsers()
    } catch (err) {
      alert(`Failed to reset vector database: ${err.message}`)
    } finally {
      setResetting(false)
    }
  }

  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      String(user.name || '').toLowerCase().includes(q) ||
      String(user.user_id || '').toLowerCase().includes(q) ||
      String(user.faiss_id || '').includes(q) ||
      String(user.metadata?.email || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="users-container animate-in">
      <Breadcrumb items={[{ label: 'Registered Users' }]} />

      <div className="page-header-row">
        <div>
          <h1 className="page-title">Enrolled Identity Registry</h1>
          <p className="page-subtitle">
            Search, inspect, and manage identities enrolled in the FAISS 1:N vector database.
          </p>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchUsers}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`btn-icon ${loading ? 'spin' : ''}`}>
              <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <Link to="/register" className="btn btn-primary btn-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="btn-icon">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="16" y1="11" x2="22" y2="11" />
            </svg>
            Enroll User
          </Link>

          {users.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm danger-text"
              onClick={handleReset}
              disabled={resetting || loading}
            >
              {resetting ? 'Resetting Index...' : 'Reset Vector DB'}
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Box */}
      {actionMessage && (
        <div className="alert-banner alert-success mb-20 animate-in">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="alert-banner alert-danger mb-20">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="alert-icon">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm ml-auto" onClick={fetchUsers}>
            Retry
          </button>
        </div>
      )}

      {/* 3 Registry KPI Cards */}
      <div className="metrics-grid mb-24">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">ENROLLED IDENTITIES</span>
            <div className="metric-icon-box primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="metric-value">{loading ? '...' : totalCount}</div>
          <div className="metric-footer">
            <span className="metric-caption">Active profiles in FAISS vector store</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">EMBEDDING MODEL</span>
            <div className="metric-icon-box info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
          </div>
          <div className="metric-value">512-d</div>
          <div className="metric-footer">
            <span className="metric-caption">InceptionResNetV1 ArcFace L2 normalized</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">VECTOR INDEX TYPE</span>
            <div className="metric-icon-box success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
          </div>
          <div className="metric-value">IndexFlatIP</div>
          <div className="metric-footer">
            <span className="metric-caption">Exhaustive inner-product cosine search</span>
          </div>
        </div>
      </div>

      {/* Main Database Table Card */}
      <div className="card mb-24">
        <div className="card-header">
          <div className="card-header-title-group">
            <h3 className="card-title">Enrolled Biometric Profiles</h3>
            <p className="card-subtitle">
              {filteredUsers.length} of {totalCount} matching identities
            </p>
          </div>

          <div className="search-input-group">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="input search-input"
              placeholder="Filter by name, user ID, or index..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="users-search-input"
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state-box">
            <div className="spin mb-8">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin-icon">
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
              </svg>
            </div>
            <p>Loading enrolled identities from vector database...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="4" />
                <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
              </svg>
            </div>
            <h4 className="empty-state-title">Identity Registry is Empty</h4>
            <p className="empty-state-text">
              No biometric face vectors have been registered in the FAISS database.
              Enroll an identity to enable live 1:N facial recognition.
            </p>
            <Link to="/register" className="btn btn-primary btn-sm mt-12" id="empty-enroll-first-btn">
              Enroll First Identity
            </Link>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state-box">
            <p className="empty-state-text">No identities match the search query &quot;{searchQuery}&quot;.</p>
            <button type="button" className="btn btn-secondary btn-sm mt-8" onClick={() => setSearchQuery('')}>
              Clear Search Filter
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Index</th>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Contact Email</th>
                  <th>Enrolled Timestamp</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.user_id}>
                    <td className="monospace-text text-muted">
                      #{user.faiss_id ?? '0'}
                    </td>
                    <td className="identity-cell">
                      <strong className="monospace-text">{user.user_id}</strong>
                    </td>
                    <td>
                      <span className="font-semibold text-primary">{user.name}</span>
                    </td>
                    <td className="text-secondary">
                      {user.metadata?.email || user.email || <span className="text-muted">N/A</span>}
                    </td>
                    <td className="timestamp-cell">
                      {formatDate(user.enrolled_at)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs danger-text"
                        onClick={() => handleDeleteUser(user.user_id, user.name)}
                        disabled={deletingId === user.user_id}
                        title={`Delete ${user.name}`}
                      >
                        {deletingId === user.user_id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Users