/**
 * TRUE FACE AI — Production API Client Service
 *
 * Connects React Frontend to FastAPI AI backend endpoints.
 */

const API_BASE_URL = 'http://localhost:8000'

/**
 * Register/enroll a user face with 512d ArcFace embedding and FAISS vector indexing.
 * POST /api/v1/enroll
 */
export async function registerUser(formData) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/enroll`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || data.error || 'Face enrollment failed')
    }
    return data
  } catch (error) {
    console.error('Error registering user:', error)
    throw error
  }
}

/**
 * Recognize a query face image against FAISS vector database (1:N search).
 * POST /api/v1/recognize
 */
export async function recognizeFace(formData) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/recognize`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || data.error || 'Face recognition failed')
    }
    return data
  } catch (error) {
    console.error('Error recognizing face:', error)
    throw error
  }
}

/**
 * Fetch all registered users in FAISS database.
 * GET /api/v1/users
 */
export async function getUsers() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/users`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch registered users')
    }
    return data
  } catch (error) {
    console.error('Error fetching users:', error)
    throw error
  }
}

/**
 * Reset/clear all vectors and metadata in vector store.
 * DELETE /api/v1/users/reset
 */
export async function resetUsers() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/users/reset`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to reset vector database')
    }
    return data
  } catch (error) {
    console.error('Error resetting database:', error)
    throw error
  }
}

/**
 * Detect faces and bounding boxes in an uploaded image.
 * POST /api/v1/detect-face
 */
export async function detectFace(formData) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/detect-face`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Face detection failed')
    }
    return data
  } catch (error) {
    console.error('Error detecting face:', error)
    throw error
  }
}

/**
 * Delete a user identity record from FAISS database.
 * DELETE /api/v1/users/{user_id}
 */
export async function deleteUser(userId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to delete user record')
    }
    return data
  } catch (error) {
    console.error('Error deleting user:', error)
    throw error
  }
}

/**
 * Fetch biometric verification audit history log.
 * GET /api/v1/history
 */
export async function getVerificationHistory(limit = 50) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/history?limit=${limit}`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch verification history')
    }
    return data
  } catch (error) {
    console.error('Error fetching history:', error)
    throw error
  }
}

/**
 * Clear biometric verification audit history log.
 * DELETE /api/v1/history/clear
 */
export async function clearVerificationHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/history/clear`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to clear verification history')
    }
    return data
  } catch (error) {
    console.error('Error clearing history:', error)
    throw error
  }
}

/**
 * Admin Login.
 * POST /api/v1/admin/login
 */
export async function adminLogin(username, password) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Admin authentication failed')
    }
    return data
  } catch (error) {
    console.error('Error logging in admin:', error)
    throw error
  }
}

/**
 * Fetch Analytics Overview statistics.
 * GET /api/v1/analytics/overview
 */
export async function getAnalyticsOverview() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/analytics/overview`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch analytics overview')
    }
    return data
  } catch (error) {
    console.error('Error fetching analytics overview:', error)
    throw error
  }
}

/**
 * Fetch Evaluation Metrics.
 * GET /api/v1/analytics/evaluation
 */
export async function getEvaluationMetrics() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/analytics/evaluation`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch evaluation metrics')
    }
    return data
  } catch (error) {
    console.error('Error fetching evaluation metrics:', error)
    throw error
  }
}

/**
 * Fetch Paginated Audit Logs with Search & Filtering.
 * GET /api/v1/audit/logs
 */
export async function getPaginatedAuditLogs({ q = '', result_filter = 'ALL', start_date = '', end_date = '', page = 1, page_size = 15 } = {}) {
  try {
    const params = new URLSearchParams()
    if (q) params.append('q', q)
    if (result_filter && result_filter !== 'ALL') params.append('result_filter', result_filter)
    if (start_date) params.append('start_date', start_date)
    if (end_date) params.append('end_date', end_date)
    params.append('page', page)
    params.append('page_size', page_size)

    const res = await fetch(`${API_BASE_URL}/api/v1/audit/logs?${params.toString()}`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch paginated audit logs')
    }
    return data
  } catch (error) {
    console.error('Error fetching audit logs:', error)
    throw error
  }
}

/**
 * Fetch Detailed Health Status of API and Models.
 * GET /api/v1/health/detailed
 */
export async function getDetailedHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/health/detailed`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch system status')
    }
    return data
  } catch (error) {
    console.error('Error fetching detailed health:', error)
    throw error
  }
}

/**
 * Fetch System Threshold Configuration.
 * GET /api/v1/config/thresholds
 */
export async function getThresholds() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/config/thresholds`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch thresholds')
    }
    return data
  } catch (error) {
    console.error('Error fetching thresholds:', error)
    throw error
  }
}

/**
 * Update System Threshold Configuration (Requires Admin Token).
 * PUT /api/v1/config/thresholds
 */
export async function updateThresholds(thresholds, token) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${API_BASE_URL}/api/v1/config/thresholds`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(thresholds),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to update thresholds')
    }
    return data
  } catch (error) {
    console.error('Error updating thresholds:', error)
    throw error
  }
}

export default {
  registerUser,
  recognizeFace,
  getUsers,
  resetUsers,
  deleteUser,
  detectFace,
  getVerificationHistory,
  clearVerificationHistory,
  adminLogin,
  getAnalyticsOverview,
  getEvaluationMetrics,
  getPaginatedAuditLogs,
  getDetailedHealth,
  getThresholds,
  updateThresholds,
}


