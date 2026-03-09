## Example Usage (Internal API)

```
import { apiRequest } from "./diva-api/apiClient"

async function getUsers() {
  const res = await apiRequest({
    endpoint: "getUsers"
  })

  if (!res.success) {
    console.error(res.error.message)
    return
  }

  console.log(res.data)
}
```

### Example External API Request

No alias required.

```
const res = await apiRequest({
  endpoint: "https://api.github.com/users/octocat",
  external: true
})
```

## Example POST

```
await apiRequest({
  endpoint: "updateProfile",
  method: "POST",
  body: {
    name: "John"
  }
})
```

## Example Error Output

Uniform for all failures.

```
{
  "success": false,
  "error": {
    "code": "HTTP_ERROR",
    "message": "Request failed with status 404"
  }
}
```
