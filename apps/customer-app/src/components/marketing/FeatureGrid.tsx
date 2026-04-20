/**
 * FeatureGrid — a simple concrete-benefit block used on all role pages.
 * Each entry has a headline, a Mr. Mwikila-style paragraph, and an
 * optional number ("cuts arrears age 45d -> 12d"). No hero imagery.
 */

export interface FeatureItem {
  readonly title: string;
  readonly body: string;
  readonly stat?: string;
}

interface Props {
  readonly items: readonly FeatureItem[];
  readonly heading?: string;
}

export function FeatureGrid({ items, heading }: Props) {
  return (
    <section className="mb-16">
      {heading && <h2 className="mb-6 text-2xl font-semibold">{heading}</h2>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            {item.stat && (
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {item.stat}
              </div>
            )}
            <h3 className="mb-2 text-lg font-semibold text-slate-900">{item.title}</h3>
            <p className="text-sm text-slate-700">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
