import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearRequest, createRequest } from "../requestManager"

describe("requestManager", () => {
  beforeEach(() => {
    clearRequest("same-key")
    clearRequest("key-a")
    clearRequest("key-b")
  })

  it("dedupes by request key and aborts previous in-flight request", () => {
    const firstController = createRequest("same-key")
    const abortSpy = vi.spyOn(firstController, "abort")

    const secondController = createRequest("same-key")

    expect(abortSpy).toHaveBeenCalledTimes(1)
    expect(secondController).not.toBe(firstController)
  })

  it("does not dedupe across different request keys", () => {
    const firstController = createRequest("key-a")
    const abortSpy = vi.spyOn(firstController, "abort")

    createRequest("key-b")

    expect(abortSpy).not.toHaveBeenCalled()
  })
})
