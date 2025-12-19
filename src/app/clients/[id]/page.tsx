import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText,
  Briefcase,
  DollarSign,
  Edit,
  Archive
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, clients, matters, transactions } from "@/db";
import { eq, sql, desc } from "drizzle-orm";
import { formatDate, formatCurrency } from "@/lib/utils";

async function getClient(id: string) {
  const client = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (client.length === 0) {
    return null;
  }

  // Get all matters for this client with balances
  const clientMatters = await db
    .select({
      id: matters.id,
      name: matters.name,
      matterNumber: matters.matterNumber,
      status: matters.status,
      practiceArea: matters.practiceArea,
      openDate: matters.openDate,
      closeDate: matters.closeDate,
    })
    .from(matters)
    .where(eq(matters.clientId, id))
    .orderBy(desc(matters.createdAt));

  // Get balances for each matter
  const mattersWithBalances = await Promise.all(
    clientMatters.map(async (matter) => {
      const balanceResult = await db
        .select({
          deposits: sql<number>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)`,
          disbursements: sql<number>`COALESCE(SUM(CASE WHEN type = 'disbursement' THEN amount ELSE 0 END), 0)`,
        })
        .from(transactions)
        .where(eq(transactions.matterId, matter.id));

      const deposits = balanceResult[0]?.deposits || 0;
      const disbursements = balanceResult[0]?.disbursements || 0;
      const balance = deposits - disbursements;

      return {
        ...matter,
        balance,
      };
    })
  );

  // Calculate total funds held for this client
  const totalFundsHeld = mattersWithBalances.reduce((sum, m) => sum + m.balance, 0);
  const openMattersCount = mattersWithBalances.filter(m => m.status === 'open').length;

  return {
    ...client[0],
    matters: mattersWithBalances,
    totalFundsHeld,
    openMattersCount,
    totalMattersCount: mattersWithBalances.length,
  };
}

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const client = await getClient(params.id);

  if (!client) {
    notFound();
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
            <Badge 
              variant={
                client.status === 'active' ? 'default' : 
                client.status === 'archived' ? 'secondary' : 'outline'
              }
            >
              {client.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">Client since {formatDate(client.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Funds Held
            </CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${client.totalFundsHeld >= 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
              {formatCurrency(client.totalFundsHeld)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all matters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Matters
            </CardTitle>
            <Briefcase className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{client.openMattersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active cases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Matters
            </CardTitle>
            <FileText className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{client.totalMattersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Client Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.email && (
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                    {client.email}
                  </a>
                </div>
              </div>
            )}

            {client.phone && (
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <a href={`tel:${client.phone}`} className="text-primary hover:underline">
                    {client.phone}
                  </a>
                </div>
              </div>
            )}

            {client.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="whitespace-pre-line">{client.address}</p>
                </div>
              </div>
            )}

            {client.notes && (
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-line">{client.notes}</p>
                </div>
              </div>
            )}

            {!client.email && !client.phone && !client.address && !client.notes && (
              <p className="text-muted-foreground text-sm">No additional information on file.</p>
            )}
          </CardContent>
        </Card>

        {/* Matters List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Matters
            </CardTitle>
            <CardDescription>
              All matters for this client
            </CardDescription>
          </CardHeader>
          <CardContent>
            {client.matters.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium">No matters yet</p>
                <p className="text-sm mt-1">Create a matter for this client to get started</p>
                <Link href={`/matters/new?clientId=${client.id}`}>
                  <Button className="mt-4">Create Matter</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matter</TableHead>
                    <TableHead>Practice Area</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.matters.map((matter) => (
                    <TableRow key={matter.id}>
                      <TableCell>
                        <Link 
                          href={`/matters/${matter.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          <div>
                            <p className="font-medium">{matter.name}</p>
                            <p className="text-xs text-muted-foreground">{matter.matterNumber}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>{matter.practiceArea || '-'}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={matter.status === 'open' ? 'default' : 'secondary'}
                        >
                          {matter.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={matter.balance >= 0 ? 'text-foreground' : 'text-muted-foreground'}>
                          {formatCurrency(matter.balance)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
