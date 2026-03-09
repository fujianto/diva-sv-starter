/**
 * Auth Handler
 * Main authentication handler with login, logout, and token refresh logic
 */

import type { RequestEvent } from '@sveltejs/kit'
import type { LoginResponseData, DivaAuthConfig } from './types'
import { DEFAULT_AUTH_CONFIG } from './types'
import { SessionHandler } from './sessionHandler'

export class AuthHandler {
  private config: DivaAuthConfig
  private sessionHandler: SessionHandler

  constructor(config: Partial<DivaAuthConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config }
    this.sessionHandler = new SessionHandler(config)
  }

  /**
   * Handle successful login
   * Creates session, sets cookies, and populates event.locals
   */
  handleLogin(event: RequestEvent, loginData: LoginResponseData): void {
    if (!loginData.success) {
      throw new Error('Invalid login response')
    }

    this.sessionHandler.createSession(event, loginData)
  }

  /**
   * Handle logout
   * Clears cookies and event.locals
   */
  handleLogout(event: RequestEvent): void {
    this.sessionHandler.clearSession(event)
  }

  /**
   * Load session on page request (called from hooks)
   * Restores session from cookies if available
   */
  async loadAndValidateSession(event: RequestEvent): Promise<boolean> {
    // If locals.user already set, session is loaded
    if (event.locals.user) {
      return true
    }

    // Try to load from cookies
    const session = this.sessionHandler.loadSession(event)

    if (!session) {
      const hasRefreshToken = !!event.cookies.get(this.config.cookieNames.refreshToken)
      const hasExpiresAt = !!event.cookies.get(this.config.cookieNames.expiresAt)

      if (!hasRefreshToken || !hasExpiresAt) {
        event.locals.isAuthenticated = false
        return false
      }

      // Access token may be missing/expired in cookie, try refresh from refresh token.
      const refreshed = await this.sessionHandler.refreshSession(event)

      if (!refreshed) {
        this.sessionHandler.clearSession(event)
        return false
      }

      event.locals.user = refreshed
      event.locals.isAuthenticated = true
      return true
    }

    // Check if expired
    if (this.sessionHandler.isSessionExpired(event)) {
      // Try to refresh
      const refreshed = await this.sessionHandler.refreshSession(event)

      if (!refreshed) {
        // Refresh failed, clear session
        this.sessionHandler.clearSession(event)
        return false
      }

      // Set refreshed session to locals
      event.locals.user = refreshed
      event.locals.isAuthenticated = true
      return true
    }

    // Session valid, set to locals
    event.locals.user = session
    event.locals.isAuthenticated = true
    return true
  }

  /**
   * Validate and refresh token if needed
   * Called during request handling - returns true if session valid
   */
  async validateSession(event: RequestEvent): Promise<boolean> {
    // No user in context, try to load from cookies
    if (!event.locals.user) {
      return this.loadAndValidateSession(event)
    }

    // User exists, check if expired
    if (this.sessionHandler.isSessionExpired(event)) {
      const refreshed = await this.sessionHandler.refreshSession(event)

      if (!refreshed) {
        this.sessionHandler.clearSession(event)
        return false
      }

      event.locals.user = refreshed
      return true
    }

    return true
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(event: RequestEvent): boolean {
    return event.locals.isAuthenticated ?? false
  }
}

// Export default auth handler instance
export const authHandler = new AuthHandler()
