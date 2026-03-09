import type { ApiResponse } from "./types/apiTypes"
import { PUBLIC_BASE_ENDPOINT } from "$env/static/public"
import { ApiError } from "./apiError"
import { getEndpointByName, resolveEndpointRoute, type HttpMethod } from "./endpointMap"
import { getAccessToken, isTokenExpired, refreshAccessToken } from "./tokenManager"
import { createRequest, clearRequest } from "./requestManager"
import { logApiError } from "./logger"

type AuthCredentials = {
  access_token?: string
  refresh_token?: string
  expires_at?: number | string
}

interface RequestOptions {
  endpoint: string
  baseEndpoint?: string
  method?: HttpMethod
  params?: Record<string, string | number>
  query?: Record<string, string | number | boolean | null | undefined | Array<string | number | boolean>>
  body?: any
  headers?: Record<string, string>
  credentials?: RequestCredentials
  authCredentials?: AuthCredentials
  external?: boolean
  requestKey?: string
  requiresAuth?: boolean
  retryCount?: number
  retryDelayMs?: number
  retryBackoffMultiplier?: number
  fetchFn?: typeof fetch
}

export async function apiRequest<T>({
  endpoint,
  baseEndpoint = PUBLIC_BASE_ENDPOINT || globalThis.process?.env?.BASE_ENDPOINT,
  method = "GET",
  params,
  query,
  body,
  headers = {},
  credentials = "same-origin",
  authCredentials,
  external = false,
  requestKey = endpoint,
  requiresAuth = true,
  retryCount,
  retryDelayMs = 0,
  retryBackoffMultiplier = 2,
  fetchFn = fetch
}: RequestOptions): Promise<ApiResponse<T>> {

  try {

    const isBrowser = typeof window !== "undefined"
    const isServer = !isBrowser
    const endpointDef = external ? undefined : getEndpointByName(endpoint)
    const resolvedMethod = (external ? method : endpointDef?.method || method) as HttpMethod
    const endpointRoute = endpointDef ? resolveEndpointRoute(endpointDef, params) : undefined

    if (!external && !endpointRoute) {
      throw new ApiError("ENDPOINT_NOT_FOUND", "Endpoint alias not found")
    }

    const appendQueryParams = (
      inputUrl: string,
      queryParams?: Record<string, string | number | boolean | null | undefined | Array<string | number | boolean>>
    ): string => {
      if (!queryParams || Object.keys(queryParams).length === 0) {
        return inputUrl
      }

      const target = new URL(inputUrl, isBrowser ? window.location.origin : undefined)
      for (const [key, value] of Object.entries(queryParams)) {
        if (value === undefined || value === null || value === "") {
          continue
        }

        if (Array.isArray(value)) {
          for (const item of value) {
            target.searchParams.append(key, String(item))
          }
          continue
        }

        target.searchParams.append(key, String(value))
      }

      if (isBrowser && target.origin === window.location.origin) {
        return `${target.pathname}${target.search}`
      }
      return target.toString()
    }

    const buildUrlForInternalEndpoint = (
      endpointName: string,
      route: string,
      routeParams?: Record<string, string | number>,
      queryParams?: Record<string, string | number | boolean | null | undefined | Array<string | number | boolean>>
    ): string => {
      // Browser calls are always proxied to avoid exposing private backend host in DevTools.
      if (isBrowser) {
        const proxyUrl = new URL(`/api/diva/${encodeURIComponent(endpointName)}`, window.location.origin)
        if (routeParams && Object.keys(routeParams).length > 0) {
          proxyUrl.searchParams.set("_route_params", JSON.stringify(routeParams))
        }
        const relativeUrl = `${proxyUrl.pathname}${proxyUrl.search}`
        return appendQueryParams(relativeUrl, queryParams)
      }

      if (!baseEndpoint) {
        throw new ApiError(
          "BASE_ENDPOINT_REQUIRED",
          "BASE_ENDPOINT is required for internal API requests."
        )
      }

      return appendQueryParams(new URL(route, baseEndpoint).toString(), queryParams)
    }

    const url = external
      ? appendQueryParams(endpoint, query)
      : buildUrlForInternalEndpoint(endpoint, endpointRoute as string, params, query)

    if (!url) {
      throw new ApiError("ENDPOINT_NOT_FOUND", "Endpoint alias not found")
    }

    const controller = createRequest(requestKey)
    try {
      let currentAuth: AuthCredentials | undefined = authCredentials
      // SSR-safe: server-side calls must use request-scoped authCredentials only.
      let token = currentAuth?.access_token ?? (requiresAuth && !isServer ? getAccessToken() : null)

      if (requiresAuth && !currentAuth?.access_token && token && !external && !isServer && isTokenExpired()) {
        await refreshAccessToken()
        token = getAccessToken()
      }

      const getExpiresAt = (value: AuthCredentials | undefined): string | undefined =>
        value?.expires_at ? String(value.expires_at) : undefined

      const createHeaders = (accessToken: string | null | undefined, auth: AuthCredentials | undefined) => ({
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(auth?.refresh_token ? { "X-Refresh-Token": auth.refresh_token } : {}),
        ...(getExpiresAt(auth) ? { "X-Expires-At": getExpiresAt(auth) } : {}),
        ...headers
      })

      const parseErrorPayload = async (response: Response) => {
        const contentType = response.headers.get("content-type") || ""
        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => null)
          return payload
        }
        const errorText = await response.text().catch(() => "")
        return errorText || null
      }

      const parseErrorMessage = (errorPayload: unknown, status: number) =>
        (typeof errorPayload === "object" && errorPayload !== null && "message" in errorPayload
          ? String((errorPayload as Record<string, unknown>).message)
          : null) || `Request failed with status ${status}`

      const parseResponseData = async (response: Response) => {
        if (response.status === 204) {
          return null as T
        }
        try {
          const responseData = await response.json()
          if (responseData === null || responseData === undefined) {
            return [] as T
          }
          return responseData as T
        } catch (error: unknown) {
          // Normalize empty/invalid JSON body on successful responses to empty array.
          if (error instanceof SyntaxError) {
            return [] as T
          }
          throw error
        }
      }

      const shouldRetryStatus = (status: number): boolean =>
        [408, 425, 429, 500, 502, 503, 504].includes(status)

      const shouldRetryError = (error: unknown): boolean => {
        if (!error || typeof error !== "object") {
          return false
        }

        const candidate = error as { name?: string; message?: string }
        if (candidate.name === "AbortError") {
          return false
        }

        if (candidate.name === "TimeoutError" || error instanceof TypeError) {
          return true
        }

        const message = (candidate.message || "").toLowerCase()
        return message.includes("timeout") || message.includes("network")
      }

      const delay = async (ms: number): Promise<void> => {
        if (ms <= 0) return
        await new Promise((resolve) => setTimeout(resolve, ms))
      }

      const requestWithRetry = async (
        requestFactory: () => Promise<Response>,
        maxRetryCount: number
      ): Promise<Response> => {
        let attempt = 0
        while (true) {
          try {
            const response = await requestFactory()
            if (response.ok || !shouldRetryStatus(response.status) || attempt >= maxRetryCount) {
              return response
            }
          } catch (error) {
            if (!shouldRetryError(error) || attempt >= maxRetryCount) {
              throw error
            }
          }

          attempt += 1
          const backoffDelay = retryDelayMs > 0
            ? Math.round(retryDelayMs * Math.pow(retryBackoffMultiplier, attempt - 1))
            : 0
          await delay(backoffDelay)
        }
      }

      const refreshAuthCredentials = async (): Promise<AuthCredentials | null> => {
        if (!currentAuth?.refresh_token) {
          return null
        }

        const refreshEndpoint = getEndpointByName("doRefreshToken")
        if (!refreshEndpoint) {
          return null
        }

        const refreshRoute = resolveEndpointRoute(refreshEndpoint)
        const refreshUrl = buildUrlForInternalEndpoint(refreshEndpoint.name, refreshRoute)

        if (!refreshUrl) {
          return null
        }

        const refreshResponse = await fetchFn(refreshUrl, {
          method: "POST",
          credentials,
          headers: createHeaders(undefined, currentAuth),
          body: JSON.stringify({
            refresh_token: currentAuth.refresh_token,
            expires_at: currentAuth.expires_at
          }),
          signal: controller.signal
        })

        if (!refreshResponse.ok) {
          return null
        }

        const refreshData = await refreshResponse.json().catch(() => null)
        const rawPayload =
          refreshData && typeof refreshData === "object" && "data" in refreshData
            ? (refreshData as Record<string, unknown>).data
            : refreshData

        if (!rawPayload || typeof rawPayload !== "object") {
          return null
        }

        const refreshPayload = rawPayload as Record<string, unknown>
        const nextAccessToken = typeof refreshPayload.access_token === "string"
          ? refreshPayload.access_token
          : (typeof refreshPayload.accessToken === "string" ? refreshPayload.accessToken : undefined)

        if (!nextAccessToken) {
          return null
        }

        const nextRefreshToken = typeof refreshPayload.refresh_token === "string"
          ? refreshPayload.refresh_token
          : (typeof refreshPayload.refreshToken === "string"
            ? refreshPayload.refreshToken
            : currentAuth.refresh_token)

        const nextExpiresAt = (refreshPayload.expires_at ?? refreshPayload.expiresAt)

        return {
          access_token: nextAccessToken,
          refresh_token: nextRefreshToken,
          expires_at: (typeof nextExpiresAt === "number" || typeof nextExpiresAt === "string")
            ? nextExpiresAt
            : currentAuth.expires_at
        }
      }

      const syncRefreshedAuthSession = async (nextAuth: AuthCredentials) => {
        if (typeof window === "undefined") {
          return
        }

        if (!nextAuth.access_token || !nextAuth.refresh_token || !nextAuth.expires_at) {
          return
        }

        await fetch("/api/auth/session", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            access_token: nextAuth.access_token,
            refresh_token: nextAuth.refresh_token,
            expires_at: nextAuth.expires_at
          })
        }).catch(() => undefined)
      }

      const resolvedRetryCount = retryCount ?? (resolvedMethod === "GET" ? 2 : 0)

      let res = await requestWithRetry(
        () =>
          fetchFn(url, {
            method: resolvedMethod,
            credentials,
            headers: createHeaders(token, currentAuth),
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
          }),
        resolvedRetryCount
      )

      if (!res.ok) {
        const errorPayload = await parseErrorPayload(res)
        const errorMessage = parseErrorMessage(errorPayload, res.status)
        const shouldTryRefresh =
          !!currentAuth?.refresh_token &&
          (res.status === 401 || errorMessage.toLowerCase().includes("access token expired"))

        if (shouldTryRefresh) {
          const refreshedCredentials = await refreshAuthCredentials()

          if (refreshedCredentials?.access_token) {
            currentAuth = refreshedCredentials
            res = await requestWithRetry(
              () =>
                fetchFn(url, {
                  method: resolvedMethod,
                  credentials,
                  headers: createHeaders(currentAuth.access_token, currentAuth),
                  body: body ? JSON.stringify(body) : undefined,
                  signal: controller.signal
                }),
              resolvedRetryCount
            )

            if (res.ok) {
              await syncRefreshedAuthSession(currentAuth)
              const data = await parseResponseData(res)
              return {
                success: true,
                data,
                meta: {
                  authCredentials: currentAuth
                }
              }
            }
          }
        }

        throw new ApiError(
          "HTTP_ERROR",
          errorMessage,
          res.status,
          errorPayload
        )
      }

      const data = await parseResponseData(res)
      return {
        success: true,
        data
      }
    } finally {
      clearRequest(requestKey)
    }

  } catch (err: any) {

    logApiError(err)

    if (err.name === "AbortError") {
      return {
        success: false,
        error: {
          code: "REQUEST_ABORTED",
          message: "Request was cancelled"
        }
      }
    }

    if (err instanceof ApiError) {
      return {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details
        }
      }
    }

    return {
      success: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: err.message || "Unexpected error"
      }
    }
  }
}
