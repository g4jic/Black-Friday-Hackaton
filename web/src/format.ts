/** Money for display, the same everywhere: whole units with thousands separators ("2,500 EUR"). Plain module (no JSX), so tests can use it. */
export function formatMoney(amount: number, currency: string): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(amount))} ${currency}`
}