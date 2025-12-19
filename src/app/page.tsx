import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Briefcase,
  Plus,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { db, matters, transactions, clients } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { formatCurrency, formatDate } from "@/lib/utils";

async function getDashboardData() {
  // Get all matters with their balances
  const allMatters = await db.select().from(matters).orderBy(desc(matters.createdAt)).limit(5);
  
  // Get recent transactions
  const recentTransactions = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      createdAt: transactions.createdAt,
      matterName: matters.name,
    })
    .from(transactions)
    .leftJoin(matters, eq(transactions.matterId, matters.id))
    .orderBy(desc(transactions.createdAt))
    .limit(10);

  // Calculate totals
  const totals = await db
    .select({
      totalDeposits: sql<number>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)`,
      totalDisbursements: sql<number>`COALESCE(SUM(CASE WHEN type = 'disbursement' THEN amount ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.status, 'completed'));

  const totalDeposits = totals[0]?.totalDeposits || 0;
  const totalDisbursements = totals[0]?.totalDisbursements || 0;
  const trustBalance = totalDeposits - totalDisbursements;

  // Get client count
  const clientCount = await db.select({ count: sql<number>`count(*)` }).from(clients);
  const matterCount = await db.select({ count: sql<number>`count(*)` }).from(matters);

  return {
    trustBalance,
    totalDeposits,
    totalDisbursements,
    clientCount: clientCount[0]?.count || 0,
    matterCount: matterCount[0]?.count || 0,
    recentMatters: allMatters,
    recentTransactions,
  };
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Trust account overview and recent activity</p>
        </div>
        <div className="flex gap-3">
          <Link href="/matters/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Matter
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trust Balance
            </CardTitle>
            <DollarSign className="h-5 w-5 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.trustBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total client funds held</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deposits
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalDeposits)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time deposits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Disbursements
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalDisbursements)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All time disbursements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Matters
            </CardTitle>
            <Briefcase className="h-5 w-5 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.matterCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{data.clientCount} clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Moved above recent activity */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common trust accounting tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/clients/new">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Plus className="h-5 w-5" />
                <span>New Client</span>
              </Button>
            </Link>
            <Link href="/matters/new">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Briefcase className="h-5 w-5" />
                <span>New Matter</span>
              </Button>
            </Link>
            <Link href="/ledger">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <DollarSign className="h-5 w-5" />
                <span>View Ledger</span>
              </Button>
            </Link>
            <Link href="/reports">
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <TrendingUp className="h-5 w-5" />
                <span>Generate Report</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Latest trust account activity</CardDescription>
              </div>
              <Link href="/ledger">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions yet</p>
                <p className="text-sm mt-1">Create a matter and record a deposit to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentTransactions.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        txn.type === 'deposit' 
                          ? 'bg-neutral-100 text-neutral-700' 
                          : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {txn.type === 'deposit' ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">{txn.matterName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {txn.type === 'deposit' ? '+' : '-'}{formatCurrency(txn.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(txn.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Matters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Matters</CardTitle>
                <CardDescription>Latest client matters</CardDescription>
              </div>
              <Link href="/matters">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentMatters.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No matters yet</p>
                <Link href="/matters/new">
                  <Button variant="outline" size="sm" className="mt-2">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Matter
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {data.recentMatters.map((matter) => (
                  <Link 
                    key={matter.id} 
                    href={`/matters/${matter.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{matter.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {matter.matterNumber || 'No matter number'}
                      </p>
                    </div>
                    <Badge variant={matter.status === 'open' ? 'default' : 'secondary'}>
                      {matter.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
