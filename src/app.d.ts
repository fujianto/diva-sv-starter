// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { LocalsUser } from '$lib/diva-auth'

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: LocalsUser | null
			isAuthenticated: boolean
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
