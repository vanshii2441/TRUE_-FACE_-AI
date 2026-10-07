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

export default { registerUser, recognizeFace, getUsers, resetUsers, deleteUser, detectFace }
