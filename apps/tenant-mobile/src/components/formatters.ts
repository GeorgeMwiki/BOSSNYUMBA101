export function formatTzs(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `TZS ${(amount / 1_000_000_000).toFixed(2)}B`
  }
  if (amount >= 1_000_000) {
    return `TZS ${(amount / 1_000_000).toFixed(2)}M`
  }
  if (amount >= 1_000) {
    return `TZS ${(amount / 1_000).toFixed(1)}K`
  }
  return `TZS ${amount.toFixed(0)}`
}

export function formatSqm(sqm: number): string {
  if (sqm >= 10_000) {
    return `${(sqm / 10_000).toFixed(2)} ha`
  }
  return `${sqm.toFixed(sqm < 10 ? 1 : 0)} m²`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}
