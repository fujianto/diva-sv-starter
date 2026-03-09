import { describe, expect, it } from 'vitest'
import { mergeAuthConfig } from '../config'

describe('mergeAuthConfig', () => {
  it('deep merges nested config without dropping defaults', () => {
    const config = mergeAuthConfig({
      redirectUrls: {
        login: '/signin',
      },
      routeProtection: {
        enabled: true,
      },
    })

    expect(config.redirectUrls.login).toBe('/signin')
    expect(config.redirectUrls.dashboard).toBe('/dashboard')
    expect(config.routeProtection.enabled).toBe(true)
    expect(config.routeProtection.protectedRoutes).toEqual([])
    expect(config.routeProtection.excludedRoutes).toEqual([])
    expect(config.cookieNames.accessToken).toBe('access_token')
  })
})
