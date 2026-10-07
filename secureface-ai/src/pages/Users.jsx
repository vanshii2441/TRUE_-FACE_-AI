import { useState, useEffect } from 'react'
import { getUsers, resetUsers, deleteUser } from '../services/api'

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

  const [searchTerm, setSearchTerm] = useState('')
  const [resetting, setResetting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // Selected user for view modal
  const [selectedUser, setSelectedUser] = useState(null)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getUsers()
      setUsers(data.users || [])
      setTotalCount(data.total_enrolled || 0)
    } catch (err) {
      setError(err.message || 'Failed to fetch enrolled user records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleDeleteUser = async (user) => {
    const confirmMsg = `Are you sure you want to delete user '${user.user_id}' (${user.name}) from the FAISS database?\n\nThis will remove their biometric identity record.`
    if (!window.confirm(confirmMsg)) {
      return
    }

    setDeletingId(user.user_id)
    try {
      await deleteUser(user.user_id)
      await fetchUsers()
      if (selectedUser?.user_id === user.user_id) {
        setSelectedUser(null)
      }
    } catch (err) {
      alert('Failed to delete user: ' + (err.message || 'Server error'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleResetDB = async () => {
    if (!window.confirm('WARNING: Are you sure you want to reset the FAISS vector database?\n\nThis will delete ALL enrolled face vectors and reset the index.')) {
      return
    }

    setResetting(true)
    try {
      await resetUsers()
      await fetchUsers()
      setSelectedUser(null)
    } catch (err) {
      alert('Failed to reset vector store: ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  // Filter users by search term
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true
    const nameMatch = (u.name || '').toLowerCase().includes(term)
    const idMatch = (u.user_id || '').toLowerCase().includes(term)
    const emailMatch = (u.extra_metadata?.email || '').toLowerCase().includes(term)
    return nameMatch || idMatch || emailMatch
  })

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>User Identity Management</h1>
          <p>
            Manage all identities enrolled in the FAISS 1:N vector database. Search, view audit details, or delete identity records.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchUsers} disabled={loading}>
            🔄 Refresh List
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleResetDB}
            disabled={resetting || users.length === 0}
            style={{ background: '#ef4444', color: '#fff' }}
          >
            {resetting ? 'Resetting Index...' : 'Clear All Users'}
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid-3 mb-24">
        <div className="stat-card animate-in animate-delay-1">
          <div className="card-icon primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">Enrolled Identifiers</div>
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
            <div className="stat-label">FAISS 1:N Search</div>
            <div className="stat-value">512d ArcFace</div>
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

      {/* Filter & Search Bar */}
      <div className="card mb-24" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search users by Name, User ID, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '36px', height: '40px' }}
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            Showing {filteredUsers.length} of {totalCount} enrolled records
          </div>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading identity records from FAISS vector store...
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '24px', color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
          ⚠️ {error}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {searchTerm ? `No users matching "${searchTerm}" found.` : 'No enrolled users found in the FAISS database.'}
          </p>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '6px' }}>
            Go to the "Register User" page to enroll identities with face photos.
          </p>
        </div>
      ) : (
        <div className="table-container animate-in animate-delay-2" id="users-table">
          <table className="table">
            <thead>
              <tr>
                <th>FAISS ID</th>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Email / Contact</th>
                <th>Status</th>
                <th>Recognition Status</th>
                <th>Enrolled Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.faiss_id ?? user.user_id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      #{user.faiss_id}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                      {user.user_id}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {user.name}
                  </td>
                  <td style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                    {user.extra_metadata?.email || 'N/A'}
                  </td>
                  <td>
                    <span className="badge badge-success">
                      <span className="status-dot online" style={{ width: '6px', height: '6px' }} />
                      Enrolled & Active
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                      Ready for 1:N Match
                    </span>
                  </td>
                  <td style={{ fontSize: 'var(--font-xs)' }}>{formatDate(user.enrolled_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedUser(user)}
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        View Details
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteUser(user)}
                        disabled={deletingId === user.user_id}
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '4px 10px', fontSize: '11px' }}
                      >
                        {deletingId === user.user_id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="card animate-in"
            style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-card)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="card-icon primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <span className="card-title">Enrolled User Profile</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedUser(null)}
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Full Display Name</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedUser.name}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>User ID</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', margin: 0 }}>
                  {selectedUser.user_id}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>FAISS Vector Slot</span>
                <p style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: '#10b981', fontFamily: 'monospace', margin: 0 }}>
                  Index #{selectedUser.faiss_id}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Email Contact</span>
                <p style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedUser.extra_metadata?.email || 'None Provided'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Enrollment Date</span>
                <p style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                  {formatDate(selectedUser.enrolled_at)}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Biometric Security</span>
                <p style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: '#10b981', margin: 0 }}>
                  512d ArcFace Verified
                </p>
              </div>
            </div>

            <div style={{ padding: '12px', background: 'rgba(59,130,246,0.08)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              🔒 <strong>Security Guarantee:</strong> Raw facial embeddings and 512-dimensional vector floats are stored securely inside the FAISS index engine and never exposed directly in frontend API payloads.
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteUser(selectedUser)}
                style={{ background: '#ef4444', color: '#fff' }}
              >
                Delete Identity Record
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedUser(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Users
