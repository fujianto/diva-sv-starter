export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

export type EndpointDefinition = {
  name: string
  route: string
  method: HttpMethod
  params: string[]
}

export const endpointMap: EndpointDefinition[] = [
  {
    name: "doLogin",
    route: "/api/auth/login",
    method: "POST",
    params: []
  },
  {
    name: "doRegisterUser",
    route: "/api/auth/register",
    method: "POST",
    params: []
  },
  {
    name: "doRefreshToken",
    route: "/api/auth/refresh",
    method: "POST",
    params: []
  },
  {
    name: "doLogout",
    route: "/api/auth/logout",
    method: "POST",
    params: []
  },
  {
    name: "getProfile",
    route: "/api/auth/me",
    method: "GET",
    params: []
  },
  {
    name: "getHealth",
    route: "/api/health",
    method: "GET",
    params: []
  },
  {
    name: "getUsers",
    route: "/api/users",
    method: "GET",
    params: []
  }
]

const endpointByName = new Map(endpointMap.map((endpoint) => [endpoint.name, endpoint]))

export const getEndpointByName = (name: string): EndpointDefinition | undefined =>
  endpointByName.get(name)

export const resolveEndpointRoute = (
  endpoint: EndpointDefinition,
  routeParams?: Record<string, string | number>
): string => {
  if (!endpoint.params.length) {
    return endpoint.route
  }

  let resolvedRoute = endpoint.route
  for (const paramName of endpoint.params) {
    const paramValue = routeParams?.[paramName]
    if (paramValue === undefined || paramValue === null || paramValue === "") {
      throw new Error(`Missing route param: ${paramName}`)
    }
    resolvedRoute = resolvedRoute.replace(`:${paramName}`, encodeURIComponent(String(paramValue)))
  }

  return resolvedRoute
}
