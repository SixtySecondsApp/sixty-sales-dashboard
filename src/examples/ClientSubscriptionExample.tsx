import React, { useState } from 'react';
import { useClients, useMRR } from '@/lib/hooks/useClients';
import { useUser } from '@/lib/hooks/useUser';
import { formatCurrency, formatPercentage } from '@/lib/utils/mrrCalculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

/**
 * Example component demonstrating the Client Subscription Management System
 * This shows how to integrate the backend APIs with React components
 */
export function ClientSubscriptionExample() {
  const { user } = useUser();
  const { clients, isLoading, createClient, updateClient, convertDealToClient } = useClients(user?.id);
  const { mrrSummary, fetchMRRSummary } = useMRR(user?.id);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  React.useEffect(() => {
    fetchMRRSummary();
  }, [fetchMRRSummary]);

  if (isLoading) {
    return <div>Loading clients...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Client Subscription Management</h1>
      
      {/* MRR Summary Cards */}
      {mrrSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(mrrSummary.total_mrr)}</div>
              <p className="text-xs text-muted-foreground">
                Monthly Recurring Revenue
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mrrSummary.active_clients}</div>
              <p className="text-xs text-muted-foreground">
                {formatPercentage(mrrSummary.active_rate)} of total clients
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average MRR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(mrrSummary.avg_mrr)}</div>
              <p className="text-xs text-muted-foreground">
                Per active client
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPercentage(mrrSummary.churn_rate)}</div>
              <p className="text-xs text-muted-foreground">
                {mrrSummary.churned_clients} churned clients
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Clients List */}
      <Card>
        <CardHeader>
          <CardTitle>Client Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {clients.map((client) => (
              <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{client.company_name}</h3>
                    <Badge variant={
                      client.status === 'active' ? 'default' :
                      client.status === 'churned' ? 'destructive' : 'secondary'
                    }>
                      {client.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {client.contact_name && (
                      <span>{client.contact_name} • </span>
                    )}
                    {client.contact_email}
                  </div>
                  <div className="text-sm mt-2">
                    <span className="font-medium">{formatCurrency(client.subscription_amount)}/month</span>
                    {client.subscription_start_date && (
                      <span className="text-muted-foreground ml-2">
                        • Started {new Date(client.subscription_start_date).toLocaleDateString()}
                      </span>
                    )}
                    {client.subscription_days > 0 && (
                      <span className="text-muted-foreground ml-2">
                        • {client.subscription_days} days ago
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {client.deal && (
                    <Badge variant="outline" className="text-xs">
                      From Deal: {client.deal.name}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedClient(
                      selectedClient === client.id ? null : client.id
                    )}
                  >
                    {selectedClient === client.id ? 'Hide' : 'Details'}
                  </Button>
                </div>
              </div>
            ))}
            
            {clients.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No clients found. Convert some deals to subscriptions to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>API Usage Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Create New Client</h4>
            <Button 
              onClick={() => createClient({
                company_name: 'Example Company',
                contact_name: 'John Doe',
                contact_email: 'john@example.com',
                subscription_amount: 500,
                owner_id: user?.id || '',
                status: 'active',
                subscription_start_date: new Date().toISOString().split('T')[0]
              })}
              size="sm"
            >
              Create Example Client
            </Button>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="font-medium mb-2">Convert Deal to Subscription</h4>
            <Button 
              onClick={() => {
                // This would typically be called with a real deal ID
                const exampleDealId = 'deal-uuid-here';
                convertDealToClient(exampleDealId, {
                  subscription_amount: 750,
                  subscription_start_date: new Date().toISOString().split('T')[0]
                });
              }}
              size="sm"
              variant="outline"
            >
              Convert Example Deal
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              This would convert a won deal into an active subscription
            </p>
          </div>
          
          <Separator />
          
          <div>
            <h4 className="font-medium mb-2">Update Client Status</h4>
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  if (clients[0]) {
                    updateClient(clients[0].id, { status: 'paused' });
                  }
                }}
                size="sm"
                variant="outline"
                disabled={!clients[0]}
              >
                Pause First Client
              </Button>
              <Button 
                onClick={() => {
                  if (clients[0]) {
                    updateClient(clients[0].id, { 
                      status: 'churned',
                      churn_date: new Date().toISOString().split('T')[0]
                    });
                  }
                }}
                size="sm"
                variant="destructive"
                disabled={!clients[0]}
              >
                Churn First Client
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Status changes automatically handle churn dates
            </p>
          </div>
        </CardContent>
      </Card>

      {/* API Endpoints Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Available API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <code className="bg-muted px-2 py-1 rounded">GET /api/clients</code>
              <span className="ml-2 text-muted-foreground">List all clients with filtering</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">POST /api/clients</code>
              <span className="ml-2 text-muted-foreground">Create new client</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">PUT /api/clients/:id</code>
              <span className="ml-2 text-muted-foreground">Update client</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">DELETE /api/clients/:id</code>
              <span className="ml-2 text-muted-foreground">Delete client</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">GET /api/clients/mrr/summary</code>
              <span className="ml-2 text-muted-foreground">MRR summary metrics</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">GET /api/clients/mrr/by-owner</code>
              <span className="ml-2 text-muted-foreground">MRR breakdown by sales rep</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">POST /api/deals/:id/convert-to-subscription</code>
              <span className="ml-2 text-muted-foreground">Convert won deal to client</span>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded">GET /api/deals/:id/subscription</code>
              <span className="ml-2 text-muted-foreground">Check if deal has subscription</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}