import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { db, clients, matters, transactions } from "@/db";
import { desc, eq, sql, count } from "drizzle-orm";
import { formatDate, formatCurrency } from "@/lib/utils";

async function getClients() {
  // Get all clients
  const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt));

  // Get matter counts and balances for each client
  const clientsWithDetails = await Promise.all(
    allClients.map(async (client) => {
      // Get matter count for this client
      const matterCountResult = await db
        .select({ count: count() })
        .from(matters)
        .where(eq(matters.clientId, client.id));
      
      const matterCount = matterCountResult[0]?.count || 0;

      // Get open matter count
      const openMatterCountResult = await db
        .select({ count: count() })
        .from(matters)
        .where(sql`${matters.clientId} = ${client.id} AND ${matters.status} = 'open'`);
      
      const openMatterCount = openMatterCountResult[0]?.count || 0;

      // Get total trust balance across all matters for this client
      const balanceResult = await db
        .select({
          deposits: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN ${transactions.amount} ELSE 0 END), 0)`,
          disbursements: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'disbursement' THEN ${transactions.amount} ELSE 0 END), 0)`,
        })
        .from(transactions)
        .innerJoin(matters, eq(transactions.matterId, matters.id))
        .where(eq(matters.clientId, client.id));

      const deposits = balanceResult[0]?.deposits || 0;
      const disbursements = balanceResult[0]?.disbursements || 0;
      const totalBalance = deposits - disbursements;

      return {
        ...client,
        matterCount,
        openMatterCount,
        totalBalance,
      };
    })
  );

  return clientsWithDetails;
}

export default async function ClientsPage() {
  const allClients = await getClients();

  // Calculate totals
  const totalFundsHeld = allClients.reduce((sum, c) => sum + c.totalBalance, 0);
  const totalMatters = allClients.reduce((sum, c) => sum + c.matterCount, 0);
  const activeClients = allClients.filter(c => c.status === 'active').length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your client directory</p>
        </div>
        <Link href="/clients/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        </Link>
      </div>

      {/* Summary Stats */}
      {allClients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <Card className="py-2">
            <CardContent className="pt-3 pb-2">
              <div className="text-lg font-semibold">{allClients.length}</div>
              <p className="text-xs text-muted-foreground">Total Clients</p>
            </CardContent>
          </Card>
          <Card className="py-2">
            <CardContent className="pt-3 pb-2">
              <div className="text-lg font-semibold">{activeClients}</div>
              <p className="text-xs text-muted-foreground">Active Clients</p>
            </CardContent>
          </Card>
          <Card className="py-2">
            <CardContent className="pt-3 pb-2">
              <div className="text-lg font-semibold">{totalMatters}</div>
              <p className="text-xs text-muted-foreground">Total Matters</p>
            </CardContent>
          </Card>
          <Card className="py-2">
            <CardContent className="pt-3 pb-2">
              <div className={`text-lg font-semibold ${totalFundsHeld >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(totalFundsHeld)}
              </div>
              <p className="text-xs text-muted-foreground">Total Trust Funds</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Clients
          </CardTitle>
          <CardDescription>
            {allClients.length} client{allClients.length !== 1 ? 's' : ''} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No clients yet</p>
              <p className="text-sm mt-1">Create your first client to get started</p>
              <Link href="/clients/new">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Client
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Matters</TableHead>
                  <TableHead className="text-right">Trust Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link 
                        href={`/clients/${client.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>{client.email || '-'}</TableCell>
                    <TableCell>{client.phone || '-'}</TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">{client.matterCount}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={client.totalBalance < 0 ? 'text-muted-foreground' : ''}>
                        {formatCurrency(client.totalBalance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          client.status === 'active' ? 'default' : 
                          client.status === 'archived' ? 'secondary' : 'outline'
                        }
                      >
                        {client.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(client.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/clients/${client.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
