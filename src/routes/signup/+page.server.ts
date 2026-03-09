import { apiRequest } from "$lib/diva-api/apiClient"
import { registerSchema } from "$lib/schemas/registerSchema"
import { fail, type Actions } from "@sveltejs/kit"
import { z } from "zod"
import { env } from "$env/dynamic/private"
import type { ApiResponse } from "$lib/diva-api/types/apiTypes"

type RegisterPayload = {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export const actions: Actions = {
  doSignup: async ({ request, fetch }) => {
    const formData: FormData = await request.formData()
    const data: Record<string, string | File> = Object.fromEntries(formData) as RegisterPayload
    const result: ReturnType<typeof registerSchema.safeParse> = registerSchema.safeParse(data)

    if (!result.success) {
      return fail(400, {
        errors: z.flattenError(result.error)
      })
    }

    const response: ApiResponse<unknown> = await apiRequest({
      endpoint: "doRegisterUser",
      baseEndpoint: env.BASE_ENDPOINT,
      method: "POST",
      requiresAuth: false,
      fetchFn: fetch,
      body: {
        username: data.username,
        email: data.email,
        password: data.password
      }
    })

    if (!response.success) {
      return fail(400, {
        errors: {
          formErrors: [response.error.details?.message || response.error.message || "Signup failed. Please try again."].filter(Boolean),
          fieldErrors: {}
        }
      })
    }

    return { success: true }
  }
}
