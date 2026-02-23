export function createRequestContext() {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  return {
    requestId,
    log(event: string, data?: Record<string, unknown>) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        requestId,
        event,
        elapsed_ms: Date.now() - startTime,
        ...data
      }))
    }
  }
}
