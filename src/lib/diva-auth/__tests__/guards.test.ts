/**
 * Auth Guards Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthGuards } from '../guards'
import type { RequestEvent } from '@sveltejs/kit'
import { redirect, error } from '@sveltejs/kit'

vi.mock('@sveltejs/kit', async () => {
  const actual = await vi.importActual('@sveltejs/kit')
  return {
    ...actual,
    redirect: vi.fn((status, url) => {
      throw new Error(`redirect:${status}:${url}`)
    }),
    error: vi.fn((status, message) => {
      throw new Error(`error:${status}:${message}`)
    }),
  }
})

const createMockEvent = (authenticated = false): Partial<RequestEvent> => ({
  locals: {
    user: authenticated
      ? {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          display_name: 'Test User',
          roles: ['user'],
          access_token: 'test_token',
          refresh_token: 'test_refresh',
          expires_at: Date.now() + 3600000,
        }
      : null,
    isAuthenticated: authenticated,
  },
})

describe('AuthGuards', () => {
  let guards: AuthGuards

  beforeEach(() => {
    guards = new AuthGuards()
    vi.clearAllMocks()
  })

  it('should return true if user is authenticated', () => {
    const event = createMockEvent(true) as RequestEvent
    expect(guards.isAuthenticated(event)).toBe(true)
  })

  it('should return false if user is not authenticated', () => {
    const event = createMockEvent(false) as RequestEvent
    expect(guards.isAuthenticated(event)).toBe(false)
  })

  it('should return false if isAuthenticated is undefined', () => {
    const event = { locals: {} } as RequestEvent
    expect(guards.isAuthenticated(event)).toBe(false)
  })

  it('should check if user has required role', () => {
    const event = createMockEvent(true) as RequestEvent
    expect(guards.hasRole(event, 'user')).toBe(true)
    expect(guards.hasRole(event, 'admin')).toBe(false)
  })

  it('should check multiple roles (OR logic)', () => {
    const event = createMockEvent(true) as RequestEvent
    expect(guards.hasRole(event, ['user', 'admin'])).toBe(true)
    expect(guards.hasRole(event, ['admin', 'super-admin'])).toBe(false)
  })

  it('should return false if user is not authenticated when checking role', () => {
    const event = createMockEvent(false) as RequestEvent
    expect(guards.hasRole(event, 'admin')).toBe(false)
  })

  it('should throw error on requireRole without permission', () => {
    const event = createMockEvent(true) as RequestEvent

    expect(() => guards.requireRole(event, 'admin')).toThrow()
  })

  it('should not throw on requireRole with permission', () => {
    const event = createMockEvent(true) as RequestEvent

    expect(() => guards.requireRole(event, 'user')).not.toThrow()
  })

  it('should redirect to login on redirectToLogin', () => {
    const event = createMockEvent(false) as RequestEvent

    expect(() => guards.redirectToLogin(event)).toThrow()
  })

  it('should redirect with message', () => {
    const event = createMockEvent(false) as RequestEvent
    const message = 'Session expired'

    try {
      guards.redirectToLogin(event, message)
    } catch (e) {
      expect((e as Error).message).toContain('redirect')
      expect((e as Error).message).toContain('Session expired')
    }
  })

  describe('requireAuth', () => {
    it('should throw if user is not authenticated', async () => {
      const event = createMockEvent(false) as RequestEvent

      try {
        await guards.requireAuth(event)
        expect.fail('Should have thrown')
      } catch (e) {
        expect((e as Error).message).toContain('redirect')
        expect((e as Error).message).toContain('/login')
      }
    })

    it('should return user data if authenticated', async () => {
      const event = createMockEvent(true) as RequestEvent
      const result = await guards.requireAuth(event)

      expect(result).toHaveProperty('user')
      expect(result.user?.username).toBe('testuser')
    })

    it('should redirect with message when not authenticated', async () => {
      const event = createMockEvent(false) as RequestEvent

      try {
        await guards.requireAuth(event)
        expect.fail('Should have thrown')
      } catch (e) {
        const errorMsg = (e as Error).message
        expect(errorMsg).toContain('redirect')
        expect(errorMsg).toContain('Please log in')
      }
    })
  })
})
