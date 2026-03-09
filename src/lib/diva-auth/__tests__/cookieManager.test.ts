/**
 * Cookie Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { CookieManager } from '../cookieManager'
import type { Cookies } from '@sveltejs/kit'

const mockCookies = (): Cookies => {
  const store = new Map<string, string>()

  return {
    get: (name: string) => store.get(name),
    set: (name: string, value: string) => {
      store.set(name, value)
    },
    delete: (name: string) => {
      store.delete(name)
    },
    getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
    has: (name: string) => store.has(name),
    serialize: () => '',
  } as unknown as Cookies
}

describe('CookieManager', () => {
  let manager: CookieManager
  let cookies: Cookies

  beforeEach(() => {
    manager = new CookieManager()
    cookies = mockCookies()
  })

  it('should set and get a cookie', () => {
    manager.setCookie(cookies, 'test_token', 'value123')
    expect(manager.getCookie(cookies, 'test_token')).toBe('value123')
  })

  it('should delete a cookie', () => {
    manager.setCookie(cookies, 'test_token', 'value123')
    manager.deleteCookie(cookies, 'test_token')
    expect(manager.getCookie(cookies, 'test_token')).toBeUndefined()
  })

  it('should set all auth cookies', () => {
    const expiresAt = Date.now() + 3600000
    manager.setAuthCookies(cookies, 'access', 'refresh', expiresAt)

    expect(manager.getCookie(cookies, 'access_token')).toBe('access')
    expect(manager.getCookie(cookies, 'refresh_token')).toBe('refresh')
    expect(manager.getCookie(cookies, 'expires_at')).toBe(String(expiresAt))
  })

  it('should get all auth cookies', () => {
    const expiresAt = Date.now() + 3600000
    manager.setAuthCookies(cookies, 'access', 'refresh', expiresAt)

    const authCookies = manager.getAuthCookies(cookies)
    expect(authCookies.accessToken).toBe('access')
    expect(authCookies.refreshToken).toBe('refresh')
    expect(authCookies.expiresAt).toBe(String(expiresAt))
  })

  it('should check if auth cookies exist', () => {
    expect(manager.hasAuthCookies(cookies)).toBe(false)

    manager.setAuthCookies(cookies, 'access', 'refresh', Date.now() + 3600000)
    expect(manager.hasAuthCookies(cookies)).toBe(true)
  })

  it('should delete all auth cookies', () => {
    manager.setAuthCookies(cookies, 'access', 'refresh', Date.now() + 3600000)
    expect(manager.hasAuthCookies(cookies)).toBe(true)

    manager.deleteAuthCookies(cookies)
    expect(manager.hasAuthCookies(cookies)).toBe(false)
  })

  it('should detect expired token', () => {
    const pastTime = Date.now() - 1000
    expect(manager.isTokenExpired(pastTime)).toBe(true)

    const futureTime = Date.now() + 3600000
    expect(manager.isTokenExpired(futureTime)).toBe(false)
  })

  it('should handle string and number expires_at', () => {
    const pastTime = Date.now() - 1000
    expect(manager.isTokenExpired(pastTime)).toBe(true)
    expect(manager.isTokenExpired(String(pastTime))).toBe(true)

    const futureTime = Date.now() + 3600000
    expect(manager.isTokenExpired(futureTime)).toBe(false)
    expect(manager.isTokenExpired(String(futureTime))).toBe(false)
  })
})
