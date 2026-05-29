import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

/**
 * PageShell — wraps every non-home marketing page so we get the same
 * Nav + Footer + skip-link + #main-content target without each page
 * re-stating it. Home page uses Nav + Footer directly because it has
 * a custom section order; everything else uses this shell.
 */
export function PageShell({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Nav />
      <main id="main-content">{children}</main>
      <Footer />
    </>
  );
}
