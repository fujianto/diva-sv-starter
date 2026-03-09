import type { RequestHandler } from './$types'
import { cookieManager } from '$lib/diva-auth/cookieManager'

type SyncSessionBody = {
  access_token?: string
  refresh_token?: string
  expires_at?: number | string
}

const normalizeExpiresAt = (value: number | string): number => {
  const numericValue = typeof value === 'string' ? Number(value) : value
  return numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue
}

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
  const payload = (await request.json().catch(() => ({}))) as SyncSessionBody

  if (!payload.access_token || !payload.refresh_token || !payload.expires_at) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'access_token, refresh_token, and expires_at are required'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const normalizedExpiresAt = normalizeExpiresAt(payload.expires_at)

  cookieManager.setAuthCookies(
    cookies,
    payload.access_token,
    payload.refresh_token,
    normalizedExpiresAt
  )

  if (locals.user) {
    locals.user = {
      ...locals.user,
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: normalizedExpiresAt
    }
  }

  locals.isAuthenticated = true

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
