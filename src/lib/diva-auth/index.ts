/**
 * Diva-Auth Library Entry Point
 * Public API exports for authentication
 */

// Types
export type {
  LocalsUser,
  AuthSession,
  LoginResponseData,
  AuthError,
  DivaAuthConfig,
} from './types'

export { DEFAULT_AUTH_CONFIG } from './types'

// Cookie Manager
export { CookieManager, cookieManager } from './cookieManager'

// Session Handler
export { SessionHandler, sessionHandler } from './sessionHandler'

// Auth Handler
export { AuthHandler, authHandler } from './auth'

// Guards
export { AuthGuards, authGuards } from './guards'

// Hook factory
export { createAuthHandle } from './hook'

// Config merge helper types
export type { DeepPartial } from './config'
export { mergeAuthConfig } from './config'
