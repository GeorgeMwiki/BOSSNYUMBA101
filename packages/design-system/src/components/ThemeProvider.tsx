"use client";

/**
 * @bossnyumba/design-system — ThemeProvider
 *
 * Ported verbatim shape from LitFin (src/components/providers/ThemeProvider.tsx).
 * Three-state theme: light | dark | system. Belt-and-suspenders application:
 * sets the Tailwind class, data-theme attribute, and color-scheme style; also
 * dispatches a custom event so non-React listeners can react.
 *
 *  - LitFin storage key `litfin-theme`        -> `bossnyumba-theme`
 *  - LitFin custom event `litfin-theme-change` -> `bossnyumba-theme-change`
 */

import * as React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";

type Theme = "light" | "dark" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

interface ThemeProviderState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "bossnyumba-theme",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Get system theme
  const getSystemTheme = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }, []);

  // Resolve the actual theme
  const resolveTheme = useCallback(
    (t: Theme): "light" | "dark" => {
      if (t === "system") {
        return getSystemTheme();
      }
      return t;
    },
    [getSystemTheme],
  );

  // Apply theme to document. Belt-and-suspenders: set the class (Tailwind
  // darkMode: ["class"] reads this), the data-theme attribute (custom CSS
  // can read this), and the color-scheme CSS property (native form widgets
  // pick this up). Also dispatches a custom event so non-React listeners
  // can react.
  const applyTheme = useCallback(
    (resolved: "light" | "dark") => {
      const root = document.documentElement;

      if (disableTransitionOnChange) {
        root.style.setProperty("--transition-duration", "0s");
      }

      // Tailwind class — primary mechanism
      root.classList.remove("light", "dark");
      root.classList.add(resolved);

      // Defensive: also set data-theme so any styles keyed off [data-theme]
      // pick it up, and so the resolved theme survives any third-party code
      // that might strip the class.
      root.setAttribute("data-theme", resolved);
      if (attribute !== "class") {
        root.setAttribute(attribute, resolved);
      }

      // color-scheme for native elements (scrollbars, form widgets)
      root.style.colorScheme = resolved;

      // Notify the rest of the app — useful for canvas, three.js, charts
      try {
        window.dispatchEvent(
          new CustomEvent("bossnyumba-theme-change", {
            detail: { theme: resolved },
          }),
        );
      } catch {
        /* SSR / no window */
      }

      if (disableTransitionOnChange) {
        // Force reflow
        void root.offsetHeight;
        root.style.removeProperty("--transition-duration");
      }
    },
    [attribute, disableTransitionOnChange],
  );

  // Initialize theme from storage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setThemeState(stored);
    }
    setMounted(true);
  }, [storageKey]);

  // Apply theme when it changes
  useEffect(() => {
    if (!mounted) return;

    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [theme, mounted, resolveTheme, applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!enableSystem || !mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme === "system") {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, enableSystem, mounted, getSystemTheme, applyTheme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      localStorage.setItem(storageKey, newTheme);
    },
    [storageKey],
  );

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Theme toggle button component
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card text-foreground transition-all duration-200 hover:bg-muted hover:border-border ${className || ""}`}
      aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} theme`}
    >
      {/* Sun icon */}
      <svg
        className={`h-4 w-4 transition-all duration-300 ${resolvedTheme === "dark" ? "rotate-0 scale-100" : "rotate-90 scale-0"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      {/* Moon icon */}
      <svg
        className={`absolute h-4 w-4 transition-all duration-300 ${resolvedTheme === "light" ? "rotate-0 scale-100" : "-rotate-90 scale-0"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  );
}
