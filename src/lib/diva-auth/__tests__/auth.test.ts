/**
 * Auth Handler Tests
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthHandler } from '../auth'
import type { RequestEvent } from '@sveltejs/kit'
import type { LoginResponseData } from '../types'

const envFile = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
const envBaseEndpoint = envFile.match(/^BASE_ENDPOINT=(.+)$/m)?.[1]?.trim()
const TEST_BASE_ENDPOINT = process.env.BASE_ENDPOINT || envBaseEndpoint
if (!TEST_BASE_ENDPOINT) {
  throw new Error('BASE_ENDPOINT is required in .env for auth tests')
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

describe('AuthHandler', () => {
  let handler: AuthHandler
  let event: Partial<RequestEvent>

  beforeEach(() => {
    process.env.BASE_ENDPOINT = TEST_BASE_ENDPOINT
    handler = new AuthHandler()
    event = createMockEvent()
  })

  it('should handle login successfully', () => {
    handler.handleLogin(event as RequestEvent, mockLoginResponse)

    expect(event.locals?.user).not.toBeNull()
    expect(event.locals?.user?.username).toBe('testuser')
    expect(event.locals?.isAuthenticated).toBe(true)
  })

  it('should throw error on invalid login response', () => {
    const invalidResponse = { ...mockLoginResponse, success: false }

    expect(() => {
      handler.handleLogin(event as RequestEvent, invalidResponse as any)
    }).toThrow()
  })

  it('should handle logout', () => {
    // First create a session
    handler.handleLogin(event as RequestEvent, mockLoginResponse)
    expect(event.locals?.user).not.toBeNull()

    // Then logout
    handler.handleLogout(event as RequestEvent)
    expect(event.locals?.user).toBeNull()
    expect(event.locals?.isAuthenticated).toBe(false)
  })

  it('should check if user is authenticated', () => {
    event.locals = { user: null, isAuthenticated: false }
    expect(handler.isAuthenticated(event as RequestEvent)).toBe(false)

    event.locals = { user: null, isAuthenticated: true }
    expect(handler.isAuthenticated(event as RequestEvent)).toBe(true)
  })

  it('should return false for undefined isAuthenticated', () => {
    event.locals = { user: null } as any
    expect(handler.isAuthenticated(event as RequestEvent)).toBe(false)
  })

  it('should load and validate session from cookies', async () => {
    const futureTime = Date.now() + 3600000
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'access_token') return 'access_token_123'
      if (name === 'refresh_token') return 'refresh_token_456'
      if (name === 'expires_at') return String(futureTime)
      return undefined
    })

    const isValid = await handler.loadAndValidateSession(event as RequestEvent)
    expect(isValid).toBe(true)
    expect(event.locals?.user).not.toBeNull()
  })

  it('should return false when no session cookies exist', async () => {
    ;(event.cookies?.get as any).mockReturnValue(undefined)

    const isValid = await handler.loadAndValidateSession(event as RequestEvent)
    expect(isValid).toBe(false)
    expect(event.locals?.isAuthenticated).toBe(false)
  })

  it('should refresh session when access token is missing but refresh token exists', async () => {
    const futureTime = Date.now() + 3600000
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'access_token') return undefined
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

    const isValid = await handler.loadAndValidateSession(event as RequestEvent)
    expect(isValid).toBe(true)
    expect(event.locals?.user?.access_token).toBe('access_token_refreshed')
    expect(event.locals?.isAuthenticated).toBe(true)
  })

  it('should return true if user already exists in locals', async () => {
    event.locals = { user: mockLoginResponse.user as any, isAuthenticated: true }

    const isValid = await handler.loadAndValidateSession(event as RequestEvent)
    expect(isValid).toBe(true)
  })

  it('should clear expired session without user data', async () => {
    const pastTime = Date.now() - 1000
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'access_token') return 'access_token_123'
      if (name === 'refresh_token') return 'refresh_token_456'
      if (name === 'expires_at') return String(pastTime)
      return undefined
    })
    ;(event.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    })

    const isValid = await handler.loadAndValidateSession(event as RequestEvent)
    expect(isValid).toBe(false)
    expect(event.locals?.user).toBeNull()
  })

  it('should validate existing session', async () => {
    // Setup existing user in locals with valid expiry
    const futureTime = Date.now() + 3600000
    event.locals = {
      user: { expires_at: futureTime } as any,
      isAuthenticated: true,
    }
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'expires_at') return String(futureTime)
      return undefined
    })

    const isValid = await handler.validateSession(event as RequestEvent)
    expect(isValid).toBe(true)
  })

  it('should clear expired user session', async () => {
    const pastTime = Date.now() - 1000
    event.locals = {
      user: { expires_at: pastTime } as any,
      isAuthenticated: true,
    }
    ;(event.cookies?.get as any).mockImplementation((name: string) => {
      if (name === 'expires_at') return String(pastTime)
      return undefined
    })

    const isValid = await handler.validateSession(event as RequestEvent)
    expect(isValid).toBe(false)
    expect(event.locals?.user).toBeNull()
  })
})
