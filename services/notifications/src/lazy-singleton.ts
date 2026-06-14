/**
 * Lazy singleton wrapper.
 *
 * Several provider/client constructors in this package read — and THROW on
 * missing — required env vars (e.g. WHATSAPP_API_URL, AFRICAS_TALKING_*). When
 * those singletons are constructed at module-init time, merely importing the
 * package barrel crashes every consumer unless ALL provider env is present.
 *
 * `lazySingleton` returns an import-safe Proxy that defers construction (and
 * therefore any env requirement) to the FIRST property or method access. The
 * env requirement itself is preserved — it just fires on first real use rather
 * than at import. `getPrototypeOf` is forwarded so `instanceof` keeps working.
 */
export function lazySingleton<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  const resolve = (): T => (instance ??= factory());
  return new Proxy({} as T, {
    get(_t, prop, recv) {
      const o = resolve();
      const v = Reflect.get(o as object, prop, recv);
      return typeof v === 'function' ? v.bind(o) : v;
    },
    has(_t, prop) {
      return Reflect.has(resolve() as object, prop);
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(resolve() as object);
    },
  });
}
