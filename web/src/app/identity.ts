import { currentAccount } from "./auth"

/**
 * Who is using the app: the signed-in account (every page needs one). History and results are stored per owner id,
 * so one browser keeps the runs of each account apart.
 */
export type CurrentUser = { readonly id: string; readonly name: string }

export function currentUser(): CurrentUser {
  const account = currentAccount()
  return account ? { id: account.id, name: account.displayName } : { id: "signed-out", name: "Account" }
}
