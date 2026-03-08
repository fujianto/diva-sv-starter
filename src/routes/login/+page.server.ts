import { apiRequest } from "$lib/api/apiClient";
import { loginSchema } from "$lib/schemas/loginSchema"
import type { LoginData } from "$lib/types/auth.type";
import { fail, type Actions } from "@sveltejs/kit"
import { z } from "zod";

export const actions: Actions = {
  doLogin: async ({ request }) => {
    const formData : FormData = await request.formData()
    const data: Record<string, string | File> = Object.fromEntries(formData) as LoginData
    const result: ReturnType<typeof loginSchema.safeParse> = loginSchema.safeParse(data)

    if (!result.success) {
      return fail (400, { 
        errors: z.flattenError(result?.error)
      })
    }

    const response = await apiRequest({
      endpoint: "doLogin",
      method: "POST",
      body: { 
        username: data.username,
        password: data.password
      }
    })

    console.log('Login response ', JSON.stringify(response))

    return { success: true, data: response?.data }
  }
}
