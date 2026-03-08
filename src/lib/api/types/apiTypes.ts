export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: Record<string, any>
}

export interface ApiFailure {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure