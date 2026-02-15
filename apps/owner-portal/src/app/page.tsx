import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bossnyumba/design-system';

export default function OwnerPortalHome() {
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
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Properties</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Income</CardTitle>
              <CardDescription>Rent collections this month</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">KES 0</p>
              <p className="text-sm text-muted-foreground">Collected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Actions</CardTitle>
              <CardDescription>Items requiring your attention</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
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
