import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@bossnyumba/design-system';

export default function AdminPortalHome() {
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
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Properties</CardTitle>
              <CardDescription>Across all tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Users</CardTitle>
              <CardDescription>Platform-wide</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support Tickets</CardTitle>
              <CardDescription>Open tickets</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
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
