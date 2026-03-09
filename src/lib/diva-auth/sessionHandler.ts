/**
 * Session Handler
 * Manages user sessions, token refresh, and session lifecycle
 */

import type { RequestEvent, Cookies } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import type { LocalsUser, LoginResponseData, DivaAuthConfig } from './types'
import { CookieManager } from './cookieManager'
import { mergeAuthConfig, type DeepPartial } from './config'

export class SessionHandler {
  private config: DivaAuthConfig
  private cookieManager: CookieManager

  constructor(config: DeepPartial<DivaAuthConfig> = {}) {
    this.config = mergeAuthConfig(config)
    this.cookieManager = new CookieManager(config)
  }

  private normalizeExpiresAt(expiresAt: number): number {
    // Accept both seconds and milliseconds from backend
    return expiresAt < 1_000_000_000_000 ? expiresAt * 1000 : expiresAt
  }

  /**
   * Create session from login response
   * Sets cookies and populates event.locals.user
   */
  createSession(
    eventOrCookies: RequestEvent | Cookies,
    loginData: LoginResponseData,
    eventLocals?: App.Locals
  ): void {
    const { access_token, refresh_token, expires_at, user } = loginData
    const normalizedExpiresAt = this.normalizeExpiresAt(expires_at)
    console.log('Creating session with login data:', { access_token, refresh_token, expires_at, user })
    // Extract cookies and locals from either RequestEvent or direct parameters
    const cookies = 'cookies' in eventOrCookies ? eventOrCookies.cookies : (eventOrCookies as Cookies)
    const locals = 'locals' in eventOrCookies ? eventOrCookies.locals : eventLocals

    if (!locals) {
      throw new Error('locals object is required for createSession')
    }

    // Set all auth cookies together
    this.cookieManager.setAuthCookies(
      cookies,
      access_token,
      refresh_token,
      normalizedExpiresAt
    )

    // Set locals.user
    locals.user = {
      access_token,
      refresh_token,
      expires_at: normalizedExpiresAt,
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      roles: user.roles,
    }

    locals.isAuthenticated = true
  }

  /**
   * Load session from cookies
   * Called in hooks.server.ts to restore session on page load
   */
  loadSession(event: RequestEvent): LocalsUser | null {
    const authCookies = this.cookieManager.getAuthCookies(event.cookies)

    if (!authCookies.accessToken || !authCookies.refreshToken || !authCookies.expiresAt) {
      return null
    }

    // Parse cookies (expiresAt is stored as string)
    const expiresAt = parseInt(authCookies.expiresAt, 10)

    // Note: We don't have user details in cookies, those would need to be fetched
    // This is a partial session - full user details come from /api/auth/me
    return {
      access_token: authCookies.accessToken,
      refresh_token: authCookies.refreshToken,
      expires_at: expiresAt,
      id: 0, // Placeholder - will be filled during refresh
      username: '',
      email: '',
      display_name: '',
      roles: [],
    }
  }

  /**
   * Check if session exists and is valid (not expired)
   */
  isSessionValid(event: RequestEvent): boolean {
    const authCookies = this.cookieManager.getAuthCookies(event.cookies)

    if (!authCookies.accessToken || !authCookies.expiresAt) {
      return false
    }

    return !this.cookieManager.isTokenExpired(authCookies.expiresAt)
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(event: RequestEvent): boolean {
    const authCookies = this.cookieManager.getAuthCookies(event.cookies)

    if (!authCookies.expiresAt) {
      return true
    }

    return this.cookieManager.isTokenExpired(authCookies.expiresAt)
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshSession(event: RequestEvent): Promise<LocalsUser | null> {
    const authCookies = this.cookieManager.getAuthCookies(event.cookies)

    if (!authCookies.refreshToken) {
      return null
    }

    try {
      const baseEndpoint = env.BASE_ENDPOINT || process.env.BASE_ENDPOINT
      const refreshUrl = this.config.refreshEndpoint.startsWith('http')
        ? this.config.refreshEndpoint
        : (baseEndpoint
          ? new URL(this.config.refreshEndpoint, baseEndpoint).toString()
          : null)

      if (!refreshUrl) {
        return null
      }

      const response = await event.fetch(refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          refresh_token: authCookies.refreshToken,
        }),
      })

      if (!response.ok) {
        return null
      }

      const responseBody = await response.json()
      const data = responseBody?.data ?? responseBody

      if (!responseBody?.success || !data?.access_token) {
        return null
      }

      // Update session with new tokens
      this.cookieManager.setAuthCookies(
        event.cookies,
        data.access_token,
        data.refresh_token || authCookies.refreshToken,
        this.normalizeExpiresAt(data.expires_at)
      )

      // Return updated partial session
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || authCookies.refreshToken,
        expires_at: this.normalizeExpiresAt(data.expires_at),
        id: data.user?.id || 0,
        username: data.user?.username || '',
        email: data.user?.email || '',
        display_name: data.user?.display_name || '',
        roles: data.user?.roles || [],
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      return null
    }
  }

  /**
   * Clear session - logout
   */
  clearSession(event: RequestEvent): void {
    this.cookieManager.deleteAuthCookies(event.cookies)
    event.locals.user = null
    event.locals.isAuthenticated = false
  }

  /**
   * Get session expiry time in seconds
   */
  getSessionExpiry(event: RequestEvent): number | null {
    const authCookies = this.cookieManager.getAuthCookies(event.cookies)

    if (!authCookies.expiresAt) {
      return null
    }

    const expiresAt = parseInt(authCookies.expiresAt, 10)
    const secondsUntilExpiry = Math.floor((expiresAt - Date.now()) / 1000)

    return Math.max(0, secondsUntilExpiry)
  }
}

// Export default session handler instance
export const sessionHandler = new SessionHandler()
