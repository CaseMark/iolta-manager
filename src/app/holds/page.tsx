import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db, holds, matters, clients } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { formatDate, formatCurrency } from "@/lib/utils";

async function getHoldsData() {
  const allHolds = await db
    .select({
      id: holds.id,
      matterId: holds.matterId,
      amount: holds.amount,
      type: holds.type,
      description: holds.description,
      status: holds.status,
      createdAt: holds.createdAt,
      releasedAt: holds.releasedAt,
      releaseReason: holds.releaseReason,
      matterName: matters.name,
      matterNumber: matters.matterNumber,
      clientName: clients.name,
    })
    .from(holds)
    .leftJoin(matters, eq(holds.matterId, matters.id))
    .leftJoin(clients, eq(matters.clientId, clients.id))
    .orderBy(desc(holds.createdAt));

  // Get totals
  const totals = await db
    .select({
      activeHolds: sql<number>`COALESCE(SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END), 0)`,
      activeCount: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)`,
      totalCount: sql<number>`count(*)`,
    })
    .from(holds);

  return {
    holds: allHolds,
    activeHoldsAmount: totals[0]?.activeHolds || 0,
    activeCount: totals[0]?.activeCount || 0,
    totalCount: totals[0]?.totalCount || 0,
  };
}

function getHoldTypeBadge(type: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    retainer: { variant: 'default', label: 'Retainer' },
    settlement: { variant: 'secondary', label: 'Settlement' },
    escrow: { variant: 'outline', label: 'Escrow' },
    compliance: { variant: 'destructive', label: 'Compliance' },
  };
  const config = variants[type] || { variant: 'outline' as const, label: type };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    active: { variant: 'default', label: 'Active' },
    released: { variant: 'secondary', label: 'Released' },
    cancelled: { variant: 'destructive', label: 'Cancelled' },
  };
  const config = variants[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default async function HoldsPage() {
  const data = await getHoldsData();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Holds</h1>
          <p className="text-muted-foreground mt-1">Manage fund holds across all matters</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Holds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(data.activeHoldsAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Hold Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Holds
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Holds Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Holds</CardTitle>
          <CardDescription>
            View and manage holds on client funds
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.holds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No holds yet</p>
              <p className="text-sm mt-1">Holds can be created from matter detail pages</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matter</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Released</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.holds.map((hold) => (
                  <TableRow key={hold.id}>
                    <TableCell>
                      <Link 
                        href={`/matters/${hold.matterId}`}
                        className="hover:text-primary hover:underline"
                      >
                        <div>
                          <p className="font-medium">{hold.matterName}</p>
                          <p className="text-xs text-muted-foreground">{hold.clientName}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>{getHoldTypeBadge(hold.type)}</TableCell>
                    <TableCell>{hold.description}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(hold.amount)}
                    </TableCell>
                    <TableCell>{getStatusBadge(hold.status || 'active')}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(hold.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {hold.releasedAt ? formatDate(hold.releasedAt) : '-'}
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
