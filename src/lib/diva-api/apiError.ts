export class ApiError extends Error {
  code: string
  status?: number
  details?: any

  constructor(code: string, message: string, status?: number, details?: any) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}