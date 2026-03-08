export type LoginData = {
  username: string
  password: string
}

export type LoginResponse = {
  success: boolean
  data?: LoginData
  errors?: Record<string, any>
}