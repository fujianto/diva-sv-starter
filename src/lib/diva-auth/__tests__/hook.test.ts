import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadAndValidateSessionMock: vi.fn(),
  enforceConfiguredRoutesMock: vi.fn(),
}))

vi.mock('../auth', () => ({
  AuthHandler: class {
    loadAndValidateSession = mocks.loadAndValidateSessionMock
  },
}))

vi.mock('../guards', () => ({
  AuthGuards: class {
    enforceConfiguredRoutes = mocks.enforceConfiguredRoutesMock
  },
}))

import { createAuthHandle } from '../hook'

describe('createAuthHandle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips auth flow for default skip path', async () => {
    const handle = createAuthHandle()
    const resolve = vi.fn(async (event) => event)
    const event = {
      url: new URL('http://localhost/api/auth/session'),
      locals: {} as App.Locals,
      cookies: { get: vi.fn() },
      fetch: vi.fn(),
    } as any

    await handle({ event, resolve } as any)

    expect(mocks.loadAndValidateSessionMock).not.toHaveBeenCalled()
    expect(mocks.enforceConfiguredRoutesMock).not.toHaveBeenCalled()
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('runs session load and route enforcement for normal paths', async () => {
    const handle = createAuthHandle()
    const resolve = vi.fn(async (event) => event)
    const event = {
      url: new URL('http://localhost/dashboard'),
      locals: {} as App.Locals,
      cookies: { get: vi.fn() },
      fetch: vi.fn(),
    } as any

    await handle({ event, resolve } as any)

    expect(event.locals.user).toBeNull()
    expect(event.locals.isAuthenticated).toBe(false)
    expect(mocks.loadAndValidateSessionMock).toHaveBeenCalledWith(event)
    expect(mocks.enforceConfiguredRoutesMock).toHaveBeenCalledWith(event)
    expect(resolve).toHaveBeenCalledTimes(1)
  })
})
