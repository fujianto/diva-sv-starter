let accessToken: string | null = null
let refreshToken: string | null = null
let expiresAt = 0

export function setTokens(token: string, refresh: string, expires: number) {
  accessToken = token
  refreshToken = refresh
  expiresAt = expires
}

export function getAccessToken() {
  return accessToken
}

export function isTokenExpired() {
  return Date.now() >= expiresAt
}

export async function refreshAccessToken() {
  if (!refreshToken) throw new Error("No refresh token")

  const res = await fetch("/api/profile/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  })

  if (!res.ok) {
    throw new Error("Refresh failed")
  }

  const data = await res.json()

  setTokens(data.accessToken, data.refreshToken, Date.now() + data.expiresIn)
}