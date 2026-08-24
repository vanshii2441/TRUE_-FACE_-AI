/**
 * SecureFace AI — API Service (Placeholder)
 *
 * This module will be implemented in Step 2 when the backend is built.
 * For now, it exports stub functions that simulate API responses.
 */

const API_BASE_URL = 'http://localhost:8000'

/**
 * Register a new user with their face image.
 * POST /register
 */
export async function registerUser(formData) {
  // TODO: Implement in Step 2
  // return await fetch(`${API_BASE_URL}/register`, {
  //   method: 'POST',
  //   body: formData,
  // }).then(res => res.json())

  return {
    status: 'SUCCESS',
    message: 'Registration endpoint not yet connected.',
    userId: formData.get('userId'),
  }
}

/**
 * Recognize a face against registered users.
 * POST /recognize
 */
export async function recognizeFace(formData) {
  // TODO: Implement in Step 2
  // return await fetch(`${API_BASE_URL}/recognize`, {
  //   method: 'POST',
  //   body: formData,
  // }).then(res => res.json())

  return {
    status: 'UNKNOWN',
    message: 'Recognition endpoint not yet connected.',
  }
}

/**
 * Fetch all registered users.
 * GET /users
 */
export async function getUsers() {
  // TODO: Implement in Step 2
  // return await fetch(`${API_BASE_URL}/users`).then(res => res.json())

  return { users: [], total: 0 }
}

export default { registerUser, recognizeFace, getUsers }
