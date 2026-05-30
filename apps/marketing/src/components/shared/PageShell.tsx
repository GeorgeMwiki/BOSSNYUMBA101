/**
 * PageShell — content wrapper for non-home marketing pages.
 *
 * LitFin-rebase: the layout (apps/marketing/src/app/layout.tsx) now
 * owns MainNav + MarketingFooter + skip-link, mirroring LitFin's RSC
 * shell. PageShell no longer renders those — it only marks
 * `#main-content` so the layout's skip-link target still resolves.
 */
export function PageShell({ children }: { readonly children: React.ReactNode }) {
  return <>{children}</>;
}
