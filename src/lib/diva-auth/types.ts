/**
 * Diva-Auth Types
 * Core type definitions for authentication
 */

export interface LocalsUser {
  access_token: string
  refresh_token: string
  expires_at: number
  id: number
  username: string
  email: string
  display_name: string
  roles: string[]
}

export interface AuthSession extends LocalsUser {
  // Extends LocalsUser for complete session data
}

export interface LoginResponseData {
  success: boolean
  access_token: string
  refresh_token: string
  expires_at: number
  user: {
    id: number
    username: string
    email: string
    display_name: string
    roles: string[]
  }
}

export interface AuthError {
  message: string
  code: string
}

export interface DivaAuthConfig {
  cookieNames: {
    accessToken: string
    refreshToken: string
    expiresAt: string
  }
  cookieOptions: {
    httpOnly: boolean
    secure: boolean
    sameSite: 'strict' | 'lax' | 'none'
    path: string
  }
  refreshEndpoint: string
  redirectUrls: {
    login: string
    dashboard: string
  }
}

export const DEFAULT_AUTH_CONFIG: DivaAuthConfig = {
  cookieNames: {
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    expiresAt: 'expires_at',
  },
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  },
  refreshEndpoint: '/api/auth/refresh',
  redirectUrls: {
    login: '/login',
    dashboard: '/dashboard',
  },
}
