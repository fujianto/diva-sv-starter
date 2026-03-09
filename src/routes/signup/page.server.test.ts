import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("$env/dynamic/private", () => ({
  env: {
    BASE_ENDPOINT: "http://localhost:3000"
  }
}))

vi.mock("$lib/diva-api/apiClient", () => ({
  apiRequest: vi.fn()
}))

import { actions } from "./+page.server"
import { apiRequest } from "$lib/diva-api/apiClient"

const createEvent = (fields: Record<string, string>) => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value)
  }

  return {
    request: {
      formData: vi.fn().mockResolvedValue(formData)
    },
    fetch: vi.fn()
  }
}

describe("signup actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns fail(400) when form validation fails", async () => {
    expect.assertions(3)

    const event = createEvent({
      username: "ab",
      email: "invalid-email",
      password: "123",
      confirmPassword: "1234"
    })

    const result = await actions.doSignup(event as never)

    expect(result).toMatchObject({ status: 400 })
    expect(result).toMatchObject({
      data: {
        errors: expect.any(Object)
      }
    })
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("returns fail(400) when register API fails", async () => {
    expect.assertions(3)

    vi.mocked(apiRequest).mockResolvedValueOnce({
      success: false,
      error: {
        code: "HTTP_ERROR",
        message: "Request failed with status 409",
        details: {
          message: "Username or email already exists"
        }
      }
    })

    const event = createEvent({
      username: "newuser",
      email: "newuser@example.com",
      password: "password123",
      confirmPassword: "password123"
    })

    const result = await actions.doSignup(event as never)

    expect(result).toMatchObject({ status: 400 })
    expect(result).toMatchObject({
      data: {
        errors: {
          formErrors: ["Username or email already exists"],
          fieldErrors: {}
        }
      }
    })
    expect(apiRequest).toHaveBeenCalledOnce()
  })

  it("calls register endpoint and returns success when signup succeeds", async () => {
    expect.assertions(3)

    vi.mocked(apiRequest).mockResolvedValueOnce({
      success: true,
      data: {
        message: "User registered successfully"
      }
    })

    const event = createEvent({
      username: "newuser",
      email: "newuser@example.com",
      password: "password123",
      confirmPassword: "password123"
    })

    const result = await actions.doSignup(event as never)

    expect(apiRequest).toHaveBeenCalledWith({
      endpoint: "doRegisterUser",
      baseEndpoint: "http://localhost:3000",
      method: "POST",
      requiresAuth: false,
      fetchFn: event.fetch,
      body: {
        username: "newuser",
        email: "newuser@example.com",
        password: "password123"
      }
    })
    expect(apiRequest).toHaveBeenCalledOnce()
    expect(result).toEqual({ success: true })
  })
})
