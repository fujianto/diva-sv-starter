# Diva-Auth Library

A complete, production-ready authentication library for SvelteKit that handles login, session management, token refresh, route protection, and more.

## Features

✅ **Secure Session Management** - Persistent sessions via httpOnly cookies
✅ **Automatic Token Refresh** - Tokens refreshed before expiration in server hooks
✅ **Route Protection** - Guards to protect routes requiring authentication
✅ **Type-Safe** - Full TypeScript support with generics
✅ **Zero Dependencies** - Uses only SvelteKit built-ins
✅ **Clean API** - Simple, composable functions
✅ **Unit Tested** - Comprehensive test suite with Vitest
✅ **Server-Side Security** - All sensitive operations happen server-side

## Installation

The library is already in your project at `/src/lib/diva-auth`. Just import and use!

## Quick Start

### 1. Update your hooks

The `/src/hooks.server.ts` file is already created and handles session loading on every request:

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks'
import { authHandler } from '$lib/diva-auth'

async function authHook({ event, resolve }) {
  event.locals.user = null
  event.locals.isAuthenticated = false

  try {
    await authHandler.loadAndValidateSession(event)
  } catch (error) {
    console.error('Auth hook error:', error)
  }

  return resolve(event)
}

export const handle = sequence(authHook)
```

### 2. Use in your login action

```typescript
// src/routes/login/+page.server.ts
import { authHandler } from '$lib/diva-auth'

export const actions = {
  doLogin: async ({ request, fetch, locals, cookies }) => {
    // ... login validation ...

    const response = await apiRequest(/* ... */)

    if (response.success) {
      // Set cookies and populate event.locals
      authHandler.handleLogin({ locals, cookies }, response.data)

      // Redirect to dashboard
      redirect(303, '/dashboard')
    }
  }
}
```

### 3. Protect routes with guards

```typescript
// src/routes/dashboard/+page.server.ts
import { authGuards } from '$lib/diva-auth'

export async function load(event) {
  // Redirect to login if not authenticated
  return authGuards.requireAuth(event)
}
```

## API Reference

### AuthHandler

Main handler for authentication operations.

```typescript
import { authHandler } from '$lib/diva-auth'

// Handle successful login
authHandler.handleLogin(event, loginResponse)

// Clear session on logout
authHandler.handleLogout(event)

// Load and validate session from cookies
await authHandler.loadAndValidateSession(event)

// Validate existing session and refresh if needed
await authHandler.validateSession(event)

// Check if user is authenticated
authHandler.isAuthenticated(event)
```

### SessionHandler

Low-level session management.

```typescript
import { SessionHandler } from '$lib/diva-auth'

const sessionHandler = new SessionHandler()

// Create session from login response
sessionHandler.createSession(event, loginData)

// Load session from cookies
const session = sessionHandler.loadSession(event)

// Check if session is valid (not expired)
sessionHandler.isSessionValid(event)

// Check if session is expired
sessionHandler.isSessionExpired(event)

// Refresh tokens using refresh token
const refreshed = await sessionHandler.refreshSession(event)

// Clear session (logout)
sessionHandler.clearSession(event)

// Get seconds until expiry
const secondsLeft = sessionHandler.getSessionExpiry(event)
```

### CookieManager

Cookie operations with security constraints.

```typescript
import { CookieManager } from '$lib/diva-auth'

const manager = new CookieManager()

// Set individual cookie
manager.setCookie(cookies, 'token_name', 'value', expiresAt)

// Get cookie value
const value = manager.getCookie(cookies, 'token_name')

// Delete cookie
manager.deleteCookie(cookies, 'token_name')

// Set all auth cookies at once
manager.setAuthCookies(cookies, accessToken, refreshToken, expiresAt)

// Get all auth cookies
const { accessToken, refreshToken, expiresAt } = manager.getAuthCookies(cookies)

// Check if auth cookies exist
manager.hasAuthCookies(cookies)

// Delete all auth cookies
manager.deleteAuthCookies(cookies)

// Check if token is expired
manager.isTokenExpired(expiresAt)
```

### AuthGuards

Route protection and authorization helpers.

```typescript
import { authGuards } from '$lib/diva-auth'

// Require authentication guard
export async function load(event) {
  return authGuards.requireAuth(event)  // Throws redirect if not authenticated
}

// Check if authenticated
if (!authGuards.isAuthenticated(event)) {
  redirect(303, '/login')
}

// Check if user has role
if (!authGuards.hasRole(event, 'admin')) {
  error(403, 'Insufficient permissions')
}

// Require specific role
authGuards.requireRole(event, 'admin')  // Throws 403 if not authorized

// Redirect to login with message
authGuards.redirectToLogin(event, 'Session expired')
```

## Data Flow

### Login Flow

```
1. User submits login form
2. +page.server.ts validates and calls API
3. API returns: { success: true, access_token, refresh_token, expires_at, user }
4. Call authHandler.handleLogin()
5. Cookies set + event.locals.user populated
6. Redirect to /dashboard
```

### Auto-Refresh Flow (on every request)

```
1. hooks.server.ts runs before route handler
2. Check event.locals.user - if exists, continue
3. If not, load from cookies
4. Check if expired: Date.now() >= expires_at
5. If expired, call sessionHandler.refreshSession()
6. If refresh succeeds, update cookies and locals
7. If refresh fails, clear session
8. Route handler gets access to event.locals.user
```

### Protected Route Flow

```
1. Route calls authGuards.requireAuth(event)
2. If event.locals.user exists and valid, return user data
3. If not, redirect to /login?message=Please log in
```

## Configuration

Default configuration in `/src/lib/diva-auth/types.ts`:

```typescript
const DEFAULT_AUTH_CONFIG = {
  cookieNames: {
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    expiresAt: 'expires_at',
  },
  cookieOptions: {
    httpOnly: true,        // JS cannot access (XSS protection)
    secure: true,          // HTTPS only in production
    sameSite: 'lax',       // CSRF protection
    path: '/',
  },
  refreshEndpoint: '/api/auth/refresh',  // Your refresh token endpoint
  redirectUrls: {
    login: '/login',
    dashboard: '/dashboard',
  },
}
```

To use custom config, create new instances:

```typescript
import { AuthHandler } from '$lib/diva-auth'

const customAuth = new AuthHandler({
  cookieNames: {
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: 'exp',
  },
  refreshEndpoint: '/api/token/refresh',
})
```

## Cookie Structure

Three httpOnly cookies are set on successful login:

| Cookie | Value | Expires |
|--------|-------|---------|
| `access_token` | JWT access token | Token expiry |
| `refresh_token` | JWT refresh token | Not set (session) |
| `expires_at` | Expiry timestamp (ms) | Not set (session) |

All cookies have:
- `httpOnly: true` - Prevents JS access (XSS protection)
- `secure: true` (production) - HTTPS only
- `sameSite: 'lax'` - CSRF protection
- `path: /` - Accessible on all routes

## Testing

Run tests with Vitest:

```bash
npm test
# or
npm run test:watch
```

Test files:
- `__tests__/cookieManager.test.ts` - Cookie operations
- `__tests__/sessionHandler.test.ts` - Session management
- `__tests__/auth.test.ts` - Authentication logic
- `__tests__/guards.test.ts` - Route protection

## Common Patterns

### Conditional rendering based on auth status

```svelte
<script>
  import { page } from '$app/stores'
</script>

{#if $page.data.user}
  <p>Welcome, {$page.data.user.display_name}</p>
  <button>Logout</button>
{:else}
  <a href="/login">Login</a>
{/if}
```

### Protected layout

```typescript
// src/routes/protected/+layout.server.ts
import { authGuards } from '$lib/diva-auth'

export async function load(event) {
  return authGuards.requireAuth(event)
}
```

### Admin-only page

```typescript
// src/routes/admin/+page.server.ts
import { authGuards } from '$lib/diva-auth'

export async function load(event) {
  authGuards.requireRole(event, 'admin')
  return { user: event.locals.user }
}
```

### Logout action

```typescript
// src/routes/+layout.server.ts
import { authHandler } from '$lib/diva-auth'

export const actions = {
  logout: async ({ locals, cookies }) => {
    authHandler.handleLogout({ locals, cookies })
    redirect(303, '/login')
  }
}
```

### Check auth in load function

```typescript
// src/routes/dashboard/+page.server.ts
import { authGuards, redirect } from '$lib/diva-auth'

export async function load(event) {
  if (!authGuards.isAuthenticated(event)) {
    authGuards.redirectToLogin(event, 'Please log in first')
  }

  return { user: event.locals.user }
}
```

## Error Handling

The library handles these scenarios gracefully:

| Scenario | Action |
|----------|--------|
| Missing cookie | Load fails, set `event.locals.user = null` |
| Expired token | Attempt refresh, clear on failure |
| Refresh fails | Clear session, redirect to login |
| Invalid response | Log error, continue without auth |
| Missing headers | Skip and continue |

## Security Considerations

✅ **httpOnly Cookies** - Prevents JavaScript/XSS access to tokens
✅ **Secure Flag** - Only sent over HTTPS in production
✅ **SameSite** - Prevents CSRF attacks
✅ **Token Refresh** - Automatic refresh before expiry
✅ **Server-Side Validation** - All checks happen server-side
✅ **No Local Storage** - Tokens never exposed to client-side code

## Troubleshooting

### "Session not persisting after refresh"
- Check: Are cookies being set? (DevTools > Application > Cookies)
- Check: Browser privacy settings not blocking cookies?
- Check: Cookie `path` configured correctly?

### "Automatic refresh not working"
- Check: `/api/auth/refresh` endpoint exists and works?
- Check: Token expiry time set correctly?
- Check: `hooks.server.ts` is being called?

### "Not redirected to login when unauthorized"
- Check: Using `requireAuth()` guard in route `+page.server.ts`?
- Check: Cookie expiry correct?
- Check: No error suppression hiding redirect?

## Future Enhancements

Possible additions:
- Two-factor authentication
- Social login integration
- Remember me functionality
- Passwordless authentication
- Rate limiting
- Activity logging

## License

MIT
