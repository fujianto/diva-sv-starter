import type { Handle } from '@sveltejs/kit'
import type { DivaAuthConfig } from './types'
import { AuthGuards } from './guards'
import { AuthHandler } from './auth'
import type { DeepPartial } from './config'

type HookOptions = {
  skipPaths?: string[]
}

const DEFAULT_SKIP_PATHS = ['/api/auth/session']

export const createAuthHandle = (
  config: DeepPartial<DivaAuthConfig> = {},
  options: HookOptions = {}
): Handle => {
  const authHandler = new AuthHandler(config)
  const authGuards = new AuthGuards(config)
  const skipPaths = options.skipPaths ?? DEFAULT_SKIP_PATHS

  return async ({ event, resolve }) => {
    if (skipPaths.includes(event.url.pathname)) {
      return resolve(event)
    }

    event.locals.user = null
    event.locals.isAuthenticated = false

    try {
      await authHandler.loadAndValidateSession(event)
    } catch (authError) {
      console.error('Auth hook error:', authError)
    }

    await authGuards.enforceConfiguredRoutes(event)
    return resolve(event)
  }
}
