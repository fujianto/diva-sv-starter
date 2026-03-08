import { ApiResponse } from "./types/apiTypes"
import { ApiError } from "./apiError"
import { endpointMap } from "./endpointMap"
import { getAccessToken, isTokenExpired, refreshAccessToken } from "./tokenManager"
import { createRequest, clearRequest } from "./requestManager"
import { logApiError } from "./logger"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

interface RequestOptions {
  endpoint: string
  method?: HttpMethod
  body?: any
  headers?: Record<string, string>
  external?: boolean
  requestKey?: string
}

export async function apiRequest<T>({
  endpoint,
  method = "GET",
  body,
  headers = {},
  external = false,
  requestKey = endpoint
}: RequestOptions): Promise<ApiResponse<T>> {

  try {

    // Resolve endpoint
    const url = external ? endpoint : endpointMap[endpoint]

    if (!url) {
      throw new ApiError("ENDPOINT_NOT_FOUND", "Endpoint alias not found")
    }

    // Token refresh
    if (!external && isTokenExpired()) {
      await refreshAccessToken()
    }

    const token = getAccessToken()

    const controller = createRequest(requestKey)

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    clearRequest(requestKey)

    if (!res.ok) {
      throw new ApiError(
        "HTTP_ERROR",
        `Request failed with status ${res.status}`,
        res.status
      )
    }

    const data = await res.json()

    if (!data) {
      throw new ApiError("EMPTY_RESPONSE", "API returned empty data")
    }

    return {
      success: true,
      data
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