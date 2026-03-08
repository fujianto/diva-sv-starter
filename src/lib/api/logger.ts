export function logApiError(error: any) {
  console.error("API ERROR:", {
    message: error.message,
    code: error.code,
    status: error.status,
    details: error.details
  })
}