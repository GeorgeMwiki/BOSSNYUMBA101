import { useState, useEffect, useCallback } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@bossnyumba/design-system';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface DashboardStats {
  totalTenants: number;
  totalProperties: number;
  activeUsers: number;
  openTickets: number;
}

function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-9 w-72 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-36 bg-gray-200 rounded animate-pulse mt-1" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-56 bg-gray-200 rounded animate-pulse mt-1" />
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function AdminPortalHome() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DashboardStats>('/admin/dashboard');
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setError(res.error || 'Failed to load dashboard data');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
              onClick={fetchStats}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  const data = stats || { totalTenants: 0, totalProperties: 0, activeUsers: 0, openTickets: 0 };

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">BOSSNYUMBA Admin Portal</h1>
          <Badge variant="secondary">Internal</Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Tenants</CardTitle>
              <CardDescription>Active organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.totalTenants}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Properties</CardTitle>
              <CardDescription>Across all tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.totalProperties}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Users</CardTitle>
              <CardDescription>Platform-wide</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.activeUsers}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support Tickets</CardTitle>
              <CardDescription>Open tickets</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.openTickets}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Management</CardTitle>
              <CardDescription>Manage organizations on the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                Create New Tenant
              </Button>
              <Button variant="outline" className="w-full justify-start">
                View All Tenants
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Subscription Management
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Platform Operations</CardTitle>
              <CardDescription>System administration tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                Audit Logs
              </Button>
              <Button variant="outline" className="w-full justify-start">
                System Health
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Feature Flags
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
