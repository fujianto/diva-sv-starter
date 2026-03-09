/**
 * Auth Guards
 * Route protection and authorization helpers
 */

import { error, redirect } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import type { DivaAuthConfig } from './types'
import { DEFAULT_AUTH_CONFIG } from './types'
import { AuthHandler } from './auth'

export class AuthGuards {
  private config: DivaAuthConfig
  private authHandler: AuthHandler

  constructor(config: Partial<DivaAuthConfig> = {}) {
    this.config = { ...DEFAULT_AUTH_CONFIG, ...config }
    this.authHandler = new AuthHandler(config)
  }

  /**
   * Require authentication guard
   * Use in +page.server.ts or +layout.server.ts to protect routes
   *
   * @example
   * export async function load(event) {
   *   return requireAuth(event)
   * }
   */
  async requireAuth(event: RequestEvent) {
    const isAuth = await this.authHandler.validateSession(event)

    if (!isAuth) {
      const message = 'Please log in to continue'
      const loginUrl = `${this.config.redirectUrls.login}?message=${encodeURIComponent(message)}`
      redirect(303, loginUrl)
    }

    return {
      user: event.locals.user,
    }
  }

  /**
   * Check if user is authenticated
   * Returns boolean instead of throwing error
   * Use when you want to conditionally render/handle unauthenticated users
   *
   * @example
   * if (!isAuthenticated(event)) {
   *   return redirect(303, '/login')
   * }
   */
  isAuthenticated(event: RequestEvent): boolean {
    return event.locals.isAuthenticated ?? false
  }

  /**
   * Check if user has required role
   *
   * @example
   * if (!hasRole(event, 'admin')) {
   *   error(403, 'Insufficient permissions')
   * }
   */
  hasRole(event: RequestEvent, role: string | string[]): boolean {
    const user = event.locals.user

    if (!user) {
      return false
    }

    const requiredRoles = Array.isArray(role) ? role : [role]
    return requiredRoles.some((r) => user.roles.includes(r))
  }

  /**
   * Require specific role
   * Throws 403 Forbidden error if user doesn't have role
   *
   * @example
   * export async function load(event) {
   *   requireRole(event, 'admin')
   *   // ...
   * }
   */
  requireRole(event: RequestEvent, role: string | string[]) {
    if (!this.hasRole(event, role)) {
      error(403, 'Insufficient permissions')
    }
  }

  /**
   * Redirect to login with optional message
   * Use in error handlers or when session expires
   *
   * @example
   * if (session.isExpired) {
   *   redirectToLogin('Session expired')
   * }
   */
  redirectToLogin(event: RequestEvent, message?: string) {
    const searchParams = new URLSearchParams()

    if (message) {
      searchParams.set('message', message)
    }

    const loginUrl = `${this.config.redirectUrls.login}?${searchParams.toString()}`
    redirect(303, loginUrl)
  }
}

// Export default guards instance
export const authGuards = new AuthGuards()
