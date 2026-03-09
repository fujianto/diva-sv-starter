import type { DivaAuthConfig } from './types'
import { DEFAULT_AUTH_CONFIG } from './types'

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export const mergeAuthConfig = (config: DeepPartial<DivaAuthConfig> = {}): DivaAuthConfig => {
  const mergedRouteProtection = {
    ...DEFAULT_AUTH_CONFIG.routeProtection,
    ...(config.routeProtection ?? {}),
  }

  return {
    ...DEFAULT_AUTH_CONFIG,
    ...config,
    cookieNames: {
      ...DEFAULT_AUTH_CONFIG.cookieNames,
      ...(config.cookieNames ?? {}),
    },
    cookieOptions: {
      ...DEFAULT_AUTH_CONFIG.cookieOptions,
      ...(config.cookieOptions ?? {}),
    },
    redirectUrls: {
      ...DEFAULT_AUTH_CONFIG.redirectUrls,
      ...(config.redirectUrls ?? {}),
    },
    routeProtection: {
      enabled: mergedRouteProtection.enabled,
      protectedRoutes: mergedRouteProtection.protectedRoutes ?? [],
      excludedRoutes: mergedRouteProtection.excludedRoutes ?? [],
    },
  }
}
