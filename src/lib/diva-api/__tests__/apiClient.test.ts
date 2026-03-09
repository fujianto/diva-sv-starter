import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf8")
const envBaseEndpoint = envFile.match(/^BASE_ENDPOINT=(.+)$/m)?.[1]?.trim()
const TEST_BASE_ENDPOINT = process.env.BASE_ENDPOINT || envBaseEndpoint
if (!TEST_BASE_ENDPOINT) {
  throw new Error("BASE_ENDPOINT is required in .env for diva-api tests")
}

const mocks = vi.hoisted(() => ({
  getAccessTokenMock: vi.fn(),
  isTokenExpiredMock: vi.fn(),
  refreshAccessTokenMock: vi.fn(),
  createRequestMock: vi.fn(),
  clearRequestMock: vi.fn(),
  logApiErrorMock: vi.fn()
}))

vi.mock("../tokenManager", () => ({
  getAccessToken: mocks.getAccessTokenMock,
  isTokenExpired: mocks.isTokenExpiredMock,
  refreshAccessToken: mocks.refreshAccessTokenMock
}))

vi.mock("../requestManager", () => ({
  createRequest: mocks.createRequestMock,
  clearRequest: mocks.clearRequestMock
}))

vi.mock("../logger", () => ({
  logApiError: mocks.logApiErrorMock
}))

import { apiRequest } from "../apiClient"

type MockResponseOptions = {
  ok: boolean
  status: number
  json?: unknown
  text?: string
  contentType?: string
}

const createMockResponse = ({
  ok,
  status,
  json,
  text = "",
  contentType = "application/json"
}: MockResponseOptions): Response => {
  return {
    ok,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? contentType : null)
    },
    json: vi.fn(async () => json),
    text: vi.fn(async () => text)
  } as unknown as Response
}

describe("apiRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createRequestMock.mockReturnValue({ signal: new AbortController().signal })
    mocks.getAccessTokenMock.mockReturnValue(null)
    mocks.isTokenExpiredMock.mockReturnValue(false)
  })

  it("returns ENDPOINT_NOT_FOUND for unknown alias", async () => {
    const result = await apiRequest({
      endpoint: "unknownAlias",
      baseEndpoint: TEST_BASE_ENDPOINT,
      requiresAuth: false
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe("ENDPOINT_NOT_FOUND")
    }
  })

  it("sends request and returns success data", async () => {
    const fetchFn = vi.fn(async () =>
      createMockResponse({
        ok: true,
        status: 200,
        json: { success: true, data: [] }
      })
    )

    const result = await apiRequest({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      method: "GET",
      requiresAuth: false,
      fetchFn
    })

    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(fetchFn).toHaveBeenCalledWith(
      `${TEST_BASE_ENDPOINT}/api/users`,
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin"
      })
    )
    expect(mocks.clearRequestMock).toHaveBeenCalledWith("getUsers")
    expect(result.success).toBe(true)
  })

  it("supports backend usage by resolving internal URL with BASE_ENDPOINT", async () => {
    const originalWindow = (globalThis as { window?: unknown }).window
    // Simulate server-side runtime.
    delete (globalThis as { window?: unknown }).window

    const fetchFn = vi.fn(async () =>
      createMockResponse({
        ok: true,
        status: 200,
        json: { success: true, data: [] }
      })
    )

    try {
      const result = await apiRequest({
        endpoint: "getUsers",
        baseEndpoint: TEST_BASE_ENDPOINT,
        method: "GET",
        requiresAuth: false,
        fetchFn
      })

      expect(fetchFn).toHaveBeenCalledWith(
        `${TEST_BASE_ENDPOINT}/api/users`,
        expect.objectContaining({
          method: "GET"
        })
      )
      expect(result.success).toBe(true)
    } finally {
      ;(globalThis as { window?: unknown }).window = originalWindow
    }
  })

  it("supports frontend usage by routing internal calls through /api/diva proxy", async () => {
    const originalWindow = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: { location: { origin: string } } }).window = {
      location: { origin: "http://localhost:5173" }
    }

    const fetchFn = vi.fn(async () =>
      createMockResponse({
        ok: true,
        status: 200,
        json: { success: true, data: [] }
      })
    )

    try {
      const result = await apiRequest({
        endpoint: "getUsers",
        baseEndpoint: TEST_BASE_ENDPOINT,
        method: "GET",
        requiresAuth: false,
        fetchFn
      })

      expect(fetchFn).toHaveBeenCalledWith(
        "/api/diva/getUsers",
        expect.objectContaining({
          method: "GET"
        })
      )
      expect(result.success).toBe(true)
    } finally {
      ;(globalThis as { window?: unknown }).window = originalWindow
    }
  })

  it("is SSR-safe by not using global token store on server runtime", async () => {
    const originalWindow = (globalThis as { window?: unknown }).window
    delete (globalThis as { window?: unknown }).window

    mocks.getAccessTokenMock.mockReturnValue("global-token-from-store")

    const fetchFn = vi.fn(async () =>
      createMockResponse({
        ok: true,
        status: 200,
        json: { success: true, data: [] }
      })
    )

    try {
      const result = await apiRequest({
        endpoint: "getUsers",
        baseEndpoint: TEST_BASE_ENDPOINT,
        method: "GET",
        requiresAuth: true,
        fetchFn
      })

      const requestOptions = fetchFn.mock.calls[0][1] as RequestInit
      const requestHeaders = requestOptions.headers as Record<string, string>
      expect(requestHeaders.Authorization).toBeUndefined()
      expect(result.success).toBe(true)
    } finally {
      ;(globalThis as { window?: unknown }).window = originalWindow
    }
  })

  it("uses request-scoped authCredentials on server runtime", async () => {
    const originalWindow = (globalThis as { window?: unknown }).window
    delete (globalThis as { window?: unknown }).window

    mocks.getAccessTokenMock.mockReturnValue("global-token-from-store")

    const fetchFn = vi.fn(async () =>
      createMockResponse({
        ok: true,
        status: 200,
        json: { success: true, data: [] }
      })
    )

    try {
      const result = await apiRequest({
        endpoint: "getUsers",
        baseEndpoint: TEST_BASE_ENDPOINT,
        method: "GET",
        requiresAuth: true,
        authCredentials: {
          access_token: "request-scoped-token"
        },
        fetchFn
      })

      const requestOptions = fetchFn.mock.calls[0][1] as RequestInit
      const requestHeaders = requestOptions.headers as Record<string, string>
      expect(requestHeaders.Authorization).toBe("Bearer request-scoped-token")
      expect(result.success).toBe(true)
    } finally {
      ;(globalThis as { window?: unknown }).window = originalWindow
    }
  })

  it("returns HTTP_ERROR with backend message", async () => {
    const fetchFn = vi.fn(async () =>
      createMockResponse({
        ok: false,
        status: 401,
        json: { success: false, message: "Access token required" }
      })
    )

    const result = await apiRequest({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      requiresAuth: false,
      fetchFn
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe("HTTP_ERROR")
      expect(result.error.message).toBe("Access token required")
    }
  })

  it("returns success with empty array when endpoint returns empty data array", async () => {
    const fetchFn = vi.fn(async () =>
      createMockResponse({
        ok: true,
        status: 200,
        json: []
      })
    )

    const result = await apiRequest<unknown[]>({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      requiresAuth: false,
      fetchFn
    })

    expect(result).toEqual({
      success: true,
      data: []
    })
  })

  it("returns success with empty array when endpoint returns nothing", async () => {
    const fetchFn = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        headers: {
          get: () => "application/json"
        },
        json: vi.fn(async () => {
          throw new SyntaxError("Unexpected end of JSON input")
        }),
        text: vi.fn(async () => "")
      } as unknown as Response)
    )

    const result = await apiRequest<unknown[]>({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      requiresAuth: false,
      fetchFn
    })

    expect(result).toEqual({
      success: true,
      data: []
    })
  })

  it("returns REQUEST_ABORTED on abort signal", async () => {
    const fetchFn = vi.fn(async () => {
      throw { name: "AbortError" }
    })

    const result = await apiRequest({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      requiresAuth: false,
      fetchFn
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe("REQUEST_ABORTED")
    }
  })

  it("supports external API requests when external is true", async () => {
    const externalUrl = "https://api.github.com/users/fujianto/repos"
    const fetchFn = vi.fn(async () =>
      createMockResponse({
        ok: true,
        status: 200,
        json: [{ id: 1, name: "repo-1" }]
      })
    )

    const result = await apiRequest<unknown[]>({
      endpoint: externalUrl,
      method: "GET",
      external: true,
      requiresAuth: false,
      fetchFn
    })

    expect(fetchFn).toHaveBeenCalledWith(
      externalUrl,
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin"
      })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual([{ id: 1, name: "repo-1" }])
    }
  })

  it("refreshes and retries when access token is expired", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 401,
          json: { success: false, message: "Access token expired" }
        })
      )
      .mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: {
            success: true,
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
            expires_at: Math.floor(Date.now() / 1000) + 900
          }
        })
      )
      .mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: { success: true, data: [{ id: 1, username: "u1" }] }
        })
      )

    const result = await apiRequest({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      requiresAuth: false,
      fetchFn,
      authCredentials: {
        access_token: "expired-access-token",
        refresh_token: "valid-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) - 10
      }
    })

    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      `${TEST_BASE_ENDPOINT}/api/auth/refresh`,
      expect.objectContaining({
        method: "POST"
      })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.meta?.authCredentials).toMatchObject({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token"
      })
    }
  })

  it("retries when request times out and succeeds on next attempt", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request timeout"))
      .mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: { success: true, data: [] }
        })
      )

    const result = await apiRequest({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      method: "GET",
      requiresAuth: false,
      retryCount: 1,
      retryDelayMs: 0,
      fetchFn
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
  })

  it("retries when endpoint returns transient 503 error", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        createMockResponse({
          ok: false,
          status: 503,
          json: { success: false, message: "Service unavailable" }
        })
      )
      .mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: { success: true, data: [{ id: 1 }] }
        })
      )

    const result = await apiRequest({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      method: "GET",
      requiresAuth: false,
      retryCount: 1,
      retryDelayMs: 0,
      fetchFn
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
  })

  it("applies exponential backoff between retries", async () => {
    vi.useFakeTimers()
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout")

    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network failure"))
      .mockRejectedValueOnce(new TypeError("Network failure"))
      .mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: { success: true, data: [] }
        })
      )

    const pending = apiRequest({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      method: "GET",
      requiresAuth: false,
      retryCount: 2,
      retryDelayMs: 10,
      retryBackoffMultiplier: 2,
      fetchFn
    })

    await vi.runAllTimersAsync()
    const result = await pending

    expect(fetchFn).toHaveBeenCalledTimes(3)
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10)
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 20)
    expect(result.success).toBe(true)

    setTimeoutSpy.mockRestore()
    vi.useRealTimers()
  })

  it("supports timeoutMs and retries after timeout", async () => {
    vi.useFakeTimers()

    const fetchFn = vi
      .fn()
      .mockImplementationOnce(
        async (_url: string, init?: RequestInit) =>
          await new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal as AbortSignal
            signal.addEventListener("abort", () =>
              reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
            )
          })
      )
      .mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: { success: true, data: [{ id: 1 }] }
        })
      )

    const pending = apiRequest({
      endpoint: "getUsers",
      baseEndpoint: TEST_BASE_ENDPOINT,
      method: "GET",
      requiresAuth: false,
      timeoutMs: 10,
      retryCount: 1,
      retryDelayMs: 0,
      fetchFn
    })

    await vi.advanceTimersByTimeAsync(20)
    const result = await pending

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)

    vi.useRealTimers()
  })
})
