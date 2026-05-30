'use client';

/**
 * BossNyumba AI Error Boundary — carbon copy of LitFin's LitFinErrorBoundary.
 * Catches runtime crashes in the floating widget and chat panel.
 *
 * Source pattern this mirrors:
 *   LITFIN_PATH/src/core/litfin-ai/components/LitFinErrorBoundary.tsx
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

const MAX_AUTO_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000] as const;

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly hasError: boolean;
  readonly error: Error | null;
  readonly retryCount: number;
  readonly isAutoRetrying: boolean;
}

function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Loading chunk') ||
    error.message.includes('ChunkLoadError')
  );
}

interface FallbackProps {
  readonly isRetrying: boolean;
  readonly isChunk: boolean;
  readonly onReset: () => void;
}

function BossNyumbaErrorFallback({
  isRetrying,
  isChunk,
  onReset,
}: FallbackProps): JSX.Element {
  const message = isRetrying
    ? 'Loading Mr. Mwikila...'
    : isChunk
      ? 'Mr. Mwikila is still loading. One moment...'
      : 'Mr. Mwikila hit a snag. Tap to retry.';
  const buttonLabel = isRetrying ? 'Loading' : 'Try again';
  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl border border-gray-200 dark:border-gray-700 text-center">
      <div className="mb-3">
        {isRetrying ? (
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <svg
            className="mx-auto h-8 w-8 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

export class LitFinErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      isAutoRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    if (
      isChunkLoadError(error) &&
      this.state.retryCount < MAX_AUTO_RETRIES
    ) {
      const delay = RETRY_DELAYS[this.state.retryCount] ?? 8000;
      this.setState({ isAutoRetrying: true });
      this.retryTimer = setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
          isAutoRetrying: false,
        }));
      }, delay);
    }
  }

  override componentWillUnmount(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  private handleReset = (): void => {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
      isAutoRetrying: false,
    });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <BossNyumbaErrorFallback
          isRetrying={this.state.isAutoRetrying}
          isChunk={isChunkLoadError(this.state.error)}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}
