/**
 * Session Handler Tests
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SessionHandler } from '../sessionHandler'
import type { RequestEvent } from '@sveltejs/kit'
import type { LoginResponseData } from '../types'

const envFile = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
const envBaseEndpoint = envFile.match(/^BASE_ENDPOINT=(.+)$/m)?.[1]?.trim()
const TEST_BASE_ENDPOINT = process.env.BASE_ENDPOINT || envBaseEndpoint
if (!TEST_BASE_ENDPOINT) {
  throw new Error('BASE_ENDPOINT is required in .env for session tests')
}

const createMockEvent = (): Partial<RequestEvent> => ({
  cookies: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
    has: vi.fn(),
    serialize: vi.fn(),
  } as any,
  locals: {
    user: null,
    isAuthenticated: false,
  },
  fetch: vi.fn(),
})

const mockLoginResponse: LoginResponseData = {
  success: true,
  access_token: 'access_token_123',
  refresh_token: 'refresh_token_456',
  expires_at: Date.now() + 3600000,
  user: {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    display_name: 'Test User',
    roles: ['user'],
  },
}

describe('SessionHandler', () => {
  let handler: SessionHandler
  let event: Partial<RequestEvent>

  beforeEach(() => {
    process.env.BASE_ENDPOINT = TEST_BASE_ENDPOINT
    handler = new SessionHandler()
    event = createMockEvent()
  })

  it('should create session from login response', () => {
    handler.createSession(event as RequestEvent, mockLoginResponse)

    expect(event.locals?.user).not.toBeNull()
    expect(event.locals?.user?.access_token).toBe('access_token_123')
    expect(event.locals?.user?.refresh_token).toBe('refresh_token_456')
    expect(event.locals?.user?.id).toBe(1)
    expect(event.locals?.user?.username).toBe('testuser')
    expect(event.locals?.isAuthenticated).toBe(true)
  })

  it('should set auth cookies on session creation', () => {
    handler.createSession(event as RequestEvent, mockLoginResponse)

    expect(event.cookies?.set).toHaveBeenCalledWith(
      expect.stringContaining('access_token'),
      'access_token_123',
      expect.any(Object)
    )
    expect(event.cookies?.set).toHaveBeenCalledWith(
      expect.stringContaining('refresh_token'),
      'refresh_token_456',
      expect.any(Object)
    )
  })

  it('should detect expired session', () => {
    const pastTime = Date.now() - 1000
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'expires_at') return String(pastTime)
      return null
    })

    const isExpired = handler.isSessionExpired(event as RequestEvent)
    expect(isExpired).toBe(true)
  })

  it('should detect valid session', () => {
    const futureTime = Date.now() + 3600000
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'expires_at') return String(futureTime)
      return 'token'
    })

    const isExpired = handler.isSessionExpired(event as RequestEvent)
    expect(isExpired).toBe(false)
  })

  it('should clear session on logout', () => {
    handler.createSession(event as RequestEvent, mockLoginResponse)
    handler.clearSession(event as RequestEvent)

    expect(event.locals?.user).toBeNull()
    expect(event.locals?.isAuthenticated).toBe(false)
    expect(event.cookies?.delete).toHaveBeenCalled()
  })

  it('should return null when loading session without cookies', () => {
    ;(event.cookies?.get as any).mockReturnValue(undefined)

    const session = handler.loadSession(event as RequestEvent)
    expect(session).toBeNull()
  })

  it('should return partial session when cookies exist', () => {
    const futureTime = Date.now() + 3600000
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'access_token') return 'access_token_123'
      if (name === 'refresh_token') return 'refresh_token_456'
      if (name === 'expires_at') return String(futureTime)
      return undefined
    })

    const session = handler.loadSession(event as RequestEvent)
    expect(session).not.toBeNull()
    expect(session?.access_token).toBe('access_token_123')
    expect(session?.refresh_token).toBe('refresh_token_456')
  })

  it('should check if session is valid', () => {
    const futureTime = Date.now() + 3600000
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'access_token') return 'access_token'
      if (name === 'expires_at') return String(futureTime)
      return undefined
    })

    const isValid = handler.isSessionValid(event as RequestEvent)
    expect(isValid).toBe(true)
  })

  it('should get session expiry in seconds', () => {
    const secondsFromNow = 1800 // 30 minutes
    const futureTime = Date.now() + secondsFromNow * 1000
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'expires_at') return String(futureTime)
      return undefined
    })

    const expiry = handler.getSessionExpiry(event as RequestEvent)
    expect(expiry).toBeGreaterThan(secondsFromNow - 2)
    expect(expiry).toBeLessThanOrEqual(secondsFromNow)
  })

  it('should call refresh endpoint with refresh token in body', async () => {
    const futureTime = Date.now() + 3600000
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'refresh_token') return 'refresh_token_456'
      if (name === 'expires_at') return String(futureTime)
      return undefined
    })
    ;(event.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        access_token: 'access_token_refreshed',
        refresh_token: 'refresh_token_refreshed',
        expires_at: futureTime + 900000,
        user: mockLoginResponse.user,
      }),
    })

    const session = await handler.refreshSession(event as RequestEvent)

    expect(event.fetch).toHaveBeenCalledWith(
      `${TEST_BASE_ENDPOINT}/api/auth/refresh`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          refresh_token: 'refresh_token_456',
        }),
      })
    )
    expect(session?.access_token).toBe('access_token_refreshed')
  })
})
