/**
 * Who is using the app. There are no accounts yet: everyone is the guest. History and results are stored per
 * owner id, so accounts can be added later by changing only this module and the HistoryStore implementation.
 */
export type CurrentUser = { readonly id: string; readonly name: string; readonly isGuest: boolean }

const GUEST: CurrentUser = Object.freeze({ id: "guest", name: "Guest", isGuest: true })

export function currentUser(): CurrentUser {
  return GUEST
}
