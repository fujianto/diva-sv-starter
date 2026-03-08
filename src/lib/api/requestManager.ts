const pendingRequests = new Map<string, AbortController>()

export function createRequest(key: string) {
  if (pendingRequests.has(key)) {
    const old = pendingRequests.get(key)!
    old.abort()
  }

  const controller = new AbortController()
  pendingRequests.set(key, controller)

  return controller
}

export function clearRequest(key: string) {
  pendingRequests.delete(key)
}