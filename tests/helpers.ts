export async function waitFor(condition: () => boolean, timeoutMs = 5000, label = "condition"): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out after ${timeoutMs} ms waiting for ${label}`)
    await new Promise((r) => setTimeout(r, 10))
  }
}

export function answerText(event: { payload: unknown }): string {
  return (event.payload as { answer: { content: { text: string } } }).answer.content.text
}
