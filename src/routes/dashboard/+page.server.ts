import { authGuards } from '$lib/diva-auth'

export const load = async (event) => {
  // Require authentication - will redirect to login if not authenticated
  return authGuards.requireAuth(event)
}
