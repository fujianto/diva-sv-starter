import { apiRequest } from "$lib/diva-api/apiClient"
import { loginSchema } from "$lib/schemas/loginSchema"
import type { LoginData, LoginResponse } from "$lib/types/auth.type"
import { fail, type Actions } from "@sveltejs/kit"
import { z } from "zod"
import { env } from '$env/dynamic/private'
import type { ApiResponse } from "$lib/diva-api/types/apiTypes"
import { sessionHandler } from "$lib/diva-auth"

export const actions: Actions = {
  doLogin: async ({ request, fetch, locals, cookies }) => {
    const formData: FormData = await request.formData()
    const data: Record<string, string | File> = Object.fromEntries(formData) as LoginData
    const result: ReturnType<typeof loginSchema.safeParse> = loginSchema.safeParse(data)

    if (!result.success) {
      return fail(400, {
        errors: z.flattenError(result?.error)
      })
    }

    console.log("Submitting login data:", data)

    const response: ApiResponse<LoginResponse> = await apiRequest({
      endpoint: "doLogin",
      baseEndpoint: env.BASE_ENDPOINT,
      method: "POST",
      requiresAuth: false,
      fetchFn: fetch,
      body: {
        login: data.username,
        password: data.password
      }
    })

    if (!response.success) {
      console.log("Login failed:", response)

      return fail(400, {
        errors: {
          formErrors: [response.error.details?.message || "Login failed. Please try again."].filter(Boolean),
          fieldErrors: {}
        }
      })
    }

    console.log("Login successful:", response)

    // Handle login with diva-auth
    // Sets cookies and populates event.locals.user
    const loginResponse = response.data as any
    const loginData = loginResponse?.data ?? loginResponse

    if (loginData?.access_token && loginData?.refresh_token) {
      // Create session - pass cookies and locals directly
      sessionHandler.createSession(cookies, loginData, locals)

      console.log("Session created, returning success")

      // Return success - redirect will be handled by client-side form enhancement
      return { success: true, user: loginData.user }
    }

    return fail(400, {
      errors: {
        formErrors: ["Login response format is invalid."],
        fieldErrors: {}
      }
    })
  }
}
