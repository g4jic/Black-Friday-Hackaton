import { useSyncExternalStore } from "react"

/**
 * The welcome transition after signing in or signing up: while it plays, the sign in screen stays on top even though
 * the account is already signed in (App and AuthRoute check this), so the animation is not cut off. Released when
 * the animation ends, fails, or the sign in fails.
 */
let holding = false
const listeners = new Set<() => void>()

export function holdWelcome(hold: boolean): void {
  if (holding === hold) return
  holding = hold
  for (const listener of listeners) listener()
}

export function useWelcomeHold(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => holding,
  )
}
