import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import {
  getEndpointByName,
  resolveEndpointRoute,
  type HttpMethod,
} from '$lib/diva-api/endpointMap'

const getRouteParams = (url: URL): Record<string, string> => {
  const rawParams = url.searchParams.get('_route_params')
  if (!rawParams) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawParams)
    return typeof parsed === 'object' && parsed ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

const buildForwardQueryString = (url: URL): string => {
  const query = new URLSearchParams(url.search)
  query.delete('_route_params')
  const queryString = query.toString()
  return queryString ? `?${queryString}` : ''
}

const pickForwardHeaders = (request: Request): HeadersInit => {
  const incomingHeaders = request.headers
  const headers: Record<string, string> = {}
  const allowedHeaders = [
    'content-type',
    'authorization',
    'x-refresh-token',
    'x-expires-at',
    'accept',
  ]

  for (const headerName of allowedHeaders) {
    const value = incomingHeaders.get(headerName)
    if (value) {
      headers[headerName] = value
    }
  }

  return headers
}

const createProxyHandler =
  (method: HttpMethod): RequestHandler =>
  async ({ params, request, fetch, url }) => {
    const endpointName = params.name
    const endpoint = getEndpointByName(endpointName)

    if (!endpoint) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Endpoint alias not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (endpoint.method !== method) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Method ${method} is not allowed for endpoint ${endpointName}`,
        }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const baseEndpoint = env.BASE_ENDPOINT || process.env.BASE_ENDPOINT
    if (!baseEndpoint) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'BASE_ENDPOINT is not configured',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    let resolvedRoute: string
    try {
      resolvedRoute = resolveEndpointRoute(endpoint, getRouteParams(url))
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : 'Invalid route params',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const targetUrl = `${new URL(resolvedRoute, baseEndpoint).toString()}${buildForwardQueryString(url)}`
    const body = method === 'GET' || method === 'DELETE' ? undefined : await request.text()

    const proxiedResponse = await fetch(targetUrl, {
      method,
      headers: pickForwardHeaders(request),
      body,
    })

    const responseText = await proxiedResponse.text()
    return new Response(responseText, {
      status: proxiedResponse.status,
      headers: {
        'Content-Type': proxiedResponse.headers.get('content-type') ?? 'application/json',
      },
    })
  }

export const GET = createProxyHandler('GET')
export const POST = createProxyHandler('POST')
export const PUT = createProxyHandler('PUT')
export const PATCH = createProxyHandler('PATCH')
export const DELETE = createProxyHandler('DELETE')
