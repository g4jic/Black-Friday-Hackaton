/** Money for display: thousands separators, decimals only when there are cents. Plain module (no JSX), so tests can use it. */
export function formatMoney(amount: number, currency: string): string {
  const fraction = Math.round(amount * 100) % 100 !== 0
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: fraction ? 2 : 0, maximumFractionDigits: 2 }).format(amount)} ${currency}`
}