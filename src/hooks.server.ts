/**
 * Server Hooks
 * Handles authentication on every server request
 */

import { sequence } from '@sveltejs/kit/hooks'
import { authHandler } from '$lib/diva-auth'

/**
 * Auth hook - runs on every request
 * Loads session from cookies and validates tokens
 */
async function authHook({ event, resolve }) {
  // Avoid refresh/session checks for token-sync endpoint to prevent refresh loops.
  if (event.url.pathname === '/api/auth/session') {
    return resolve(event)
  }

  // Initialize locals
  event.locals.user = null
  event.locals.isAuthenticated = false

  // Try to load and validate session
  try {
    await authHandler.loadAndValidateSession(event)
  } catch (error) {
    console.error('Auth hook error:', error)
    // Continue without user if auth fails
  }

  return resolve(event)
}

export const handle = sequence(authHook)
