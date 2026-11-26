import { useEffect, useState } from "react"

type Health = { status: string; mode: "demo" | "live" }

// Placeholder screen for the skeleton. The real screens are designed with Uizze in a later step.
export function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json() as Promise<Health>)
      .then(setHealth)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl bg-white shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-semibold">SuiteSpot</h1>
        <p className="mt-2 text-slate-600">Is this lease a good financial decision for my business?</p>
        <p className="mt-6 text-sm">
          Server:{" "}
          {error ? <span className="text-red-600">{error}</span> : health ? `${health.status} (${health.mode} mode)` : "..."}
        </p>
      </div>
    </main>
  )
}
