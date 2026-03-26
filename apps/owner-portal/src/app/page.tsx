import { useState, useEffect, useCallback } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bossnyumba/design-system';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api, formatCurrency } from '../lib/api';

interface PortfolioSummary {
  totalProperties: number;
  monthlyIncome: number;
  pendingApprovals: number;
}

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 h-9 w-96 bg-gray-200 rounded animate-pulse" />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-44 bg-gray-200 rounded animate-pulse mt-1" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8">
          <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </main>
  );
}

export default function OwnerPortalHome() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PortfolioSummary>('/portfolio/summary');
      if (res.success && res.data) {
        setSummary(res.data);
      } else {
        const errMsg = res.error && typeof res.error === 'object' ? res.error.message : 'Failed to load portfolio data';
        setError(errMsg);
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">Failed to Load Dashboard</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
            <button
              onClick={fetchSummary}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  const data = summary || { totalProperties: 0, monthlyIncome: 0, pendingApprovals: 0 };

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-3xl font-bold">Welcome to BOSSNYUMBA Owner Portal</h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Overview</CardTitle>
              <CardDescription>View your property investments</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.totalProperties}</p>
              <p className="text-sm text-muted-foreground">Properties</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Income</CardTitle>
              <CardDescription>Rent collections this month</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(data.monthlyIncome)}</p>
              <p className="text-sm text-muted-foreground">Collected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Actions</CardTitle>
              <CardDescription>Items requiring your attention</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.pendingApprovals}</p>
              <p className="text-sm text-muted-foreground">Pending approvals</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Button>View All Properties</Button>
        </div>
      </div>
    </main>
  );
}
