export type LoginData = {
  username: string
  password: string
}

export type LoginPayload = {
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

export type LoginSuccessData = {
  success: true
  data: LoginPayload
}

export type LoginFailureData = {
  success: boolean
  message?: string
  errors?: {
    formErrors: string[]
    fieldErrors: Record<string, string[]>
  }
}

export type LoginResponse = LoginSuccessData | LoginFailureData
