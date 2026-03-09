/**
 * Cookie Manager
 * Handles secure cookie operations for authentication tokens
 */

import type { Cookies } from '@sveltejs/kit'
import type { DivaAuthConfig } from './types'
import { mergeAuthConfig, type DeepPartial } from './config'

export class CookieManager {
  private config: DivaAuthConfig

  constructor(config: DeepPartial<DivaAuthConfig> = {}) {
    this.config = mergeAuthConfig(config)
  }

  /**
   * Set an authentication cookie
   */
  setCookie(
    cookies: Cookies,
    name: string,
    value: string,
    expiresAt?: number
  ): void {
    const options = this.config.cookieOptions
    const expires = expiresAt ? new Date(expiresAt) : undefined

    console.log('setCookie called:', {
      name,
      value: value?.substring(0, 20) + '...',
      expiresAt,
      expires,
      httpOnly: options.httpOnly,
      secure: options.secure,
      sameSite: options.sameSite,
      path: options.path,
    })

    cookies.set(name, value, {
      httpOnly: options.httpOnly,
      secure: options.secure,
      sameSite: options.sameSite,
      path: options.path,
      expires,
    })

    console.log('Cookie set successfully:', name)
  }

  /**
   * Get a cookie value
   */
  getCookie(cookies: Cookies, name: string): string | undefined {
    return cookies.get(name)
  }

  /**
   * Delete an authentication cookie
   */
  deleteCookie(cookies: Cookies, name: string): void {
    cookies.delete(name, { path: this.config.cookieOptions.path })
  }

  /**
   * Set all auth tokens as cookies
   */
  setAuthCookies(
    cookies: Cookies,
    accessToken: string,
    refreshToken: string,
    expiresAt: number
  ): void {
    const names = this.config.cookieNames

    console.log('setAuthCookies called with:', {
      accessToken: accessToken?.substring(0, 20) + '...',
      refreshToken: refreshToken?.substring(0, 20) + '...',
      expiresAt,
      cookieNames: names,
    })

    console.log('Setting access_token cookie:', {
      name: names.accessToken,
      value: accessToken?.substring(0, 20) + '...',
      expiresAt,
    })
    this.setCookie(cookies, names.accessToken, accessToken, expiresAt)

    console.log('Setting refresh_token cookie:', {
      name: names.refreshToken,
      value: refreshToken?.substring(0, 20) + '...',
    })
    this.setCookie(cookies, names.refreshToken, refreshToken)

    console.log('Setting expires_at cookie:', {
      name: names.expiresAt,
      value: String(expiresAt),
    })
    this.setCookie(cookies, names.expiresAt, String(expiresAt))
  }

  /**
   * Get all auth cookies as object
   */
  getAuthCookies(cookies: Cookies) {
    const names = this.config.cookieNames

    return {
      accessToken: this.getCookie(cookies, names.accessToken),
      refreshToken: this.getCookie(cookies, names.refreshToken),
      expiresAt: this.getCookie(cookies, names.expiresAt),
    }
  }

  /**
   * Delete all auth cookies
   */
  deleteAuthCookies(cookies: Cookies): void {
    const names = this.config.cookieNames

    this.deleteCookie(cookies, names.accessToken)
    this.deleteCookie(cookies, names.refreshToken)
    this.deleteCookie(cookies, names.expiresAt)
  }

  /**
   * Check if authentication cookies exist
   */
  hasAuthCookies(cookies: Cookies): boolean {
    const authCookies = this.getAuthCookies(cookies)
    return !!(
      authCookies.accessToken &&
      authCookies.refreshToken &&
      authCookies.expiresAt
    )
  }

  /**
   * Validate that cookies are not expired
   */
  isTokenExpired(expiresAt: string | number): boolean {
    const expiresAtMs = typeof expiresAt === 'string' ? parseInt(expiresAt, 10) : expiresAt
    return Date.now() >= expiresAtMs
  }
}

// Export default manager instance
export const cookieManager = new CookieManager()
