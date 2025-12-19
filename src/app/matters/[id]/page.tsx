import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, 
  DollarSign, 
  TrendingUp,
  User,
  Calendar,
  Briefcase,
  Lock,
  Wallet,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, matters, clients, transactions, holds } from "@/db";
import { eq, sql, desc, and } from "drizzle-orm";
import { formatDate, formatCurrency } from "@/lib/utils";
import { TransactionForm } from "@/components/matters/transaction-form";
import { HoldForm } from "@/components/holds/hold-form";
import { HoldList } from "@/components/holds/hold-list";
import { MatterActions } from "@/components/matters/matter-actions";
import { DocumentAnalyzer } from "@/components/matters/document-analyzer";

async function getMatter(id: string) {
  const matter = await db
    .select({
      id: matters.id,
      clientId: matters.clientId,
      name: matters.name,
      matterNumber: matters.matterNumber,
      description: matters.description,
      status: matters.status,
      practiceArea: matters.practiceArea,
      responsibleAttorney: matters.responsibleAttorney,
      openDate: matters.openDate,
      closeDate: matters.closeDate,
      createdAt: matters.createdAt,
      casedevAccountId: matters.casedevAccountId,
      clientName: clients.name,
      clientEmail: clients.email,
      clientPhone: clients.phone,
    })
    .from(matters)
    .leftJoin(clients, eq(matters.clientId, clients.id))
    .where(eq(matters.id, id))
    .limit(1);

  if (matter.length === 0) {
    return null;
  }

  // Get balance
  const balanceResult = await db
    .select({
      deposits: sql<number>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)`,
      disbursements: sql<number>`COALESCE(SUM(CASE WHEN type = 'disbursement' THEN amount ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.matterId, id));

  const deposits = balanceResult[0]?.deposits || 0;
  const disbursements = balanceResult[0]?.disbursements || 0;
  const balance = deposits - disbursements;

  // Get active holds
  const activeHoldsResult = await db
    .select({
      totalHolds: sql<number>`COALESCE(SUM(amount), 0)`,
    })
    .from(holds)
    .where(and(
      eq(holds.matterId, id),
      eq(holds.status, 'active')
    ));

  const activeHoldsAmount = activeHoldsResult[0]?.totalHolds || 0;
  const availableBalance = balance - activeHoldsAmount;

  // Get all holds for this matter
  const matterHolds = await db
    .select()
    .from(holds)
    .where(eq(holds.matterId, id))
    .orderBy(desc(holds.createdAt));

  // Get transactions
  const matterTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.matterId, id))
    .orderBy(desc(transactions.createdAt));

  // Calculate running balance for each transaction
  let runningBalance = 0;
  const transactionsWithBalance = [...matterTransactions].reverse().map((txn) => {
    if (txn.type === 'deposit') {
      runningBalance += txn.amount;
    } else {
      runningBalance -= txn.amount;
    }
    return {
      ...txn,
      runningBalance,
    };
  }).reverse();

  return {
    ...matter[0],
    balance,
    availableBalance,
    activeHoldsAmount,
    totalDeposits: deposits,
    totalDisbursements: disbursements,
    transactions: transactionsWithBalance,
    holds: matterHolds,
  };
}

export default async function MatterDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const matter = await getMatter(params.id);

  if (!matter) {
    notFound();
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/matters">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{matter.name}</h1>
            <Badge variant={matter.status === 'open' ? 'default' : 'secondary'}>
              {matter.status}
            </Badge>
            {matter.casedevAccountId && (
              <Badge variant="outline" className="bg-neutral-100 text-neutral-700 border-neutral-300">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Secured
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {matter.matterNumber} • {matter.clientName}
          </p>
        </div>
      </div>

      {/* Stats Cards - Updated with Available Balance */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trust Balance
            </CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${matter.balance < 0 ? 'text-muted-foreground' : ''}`}>
              {formatCurrency(matter.balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total funds held</p>
          </CardContent>
        </Card>

        {/* Available Balance - Prominently Displayed */}
        <Card className="border-2 border-neutral-300 bg-neutral-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              Available Balance
            </CardTitle>
            <Wallet className="h-5 w-5 text-neutral-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${matter.availableBalance < 0 ? 'text-muted-foreground' : ''}`}>
              {formatCurrency(matter.availableBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Balance minus holds</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Holds
            </CardTitle>
            <Lock className="h-5 w-5 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(matter.activeHoldsAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Funds on hold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Activity
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-neutral-400" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              <span>+{formatCurrency(matter.totalDeposits)}</span>
            </div>
            <div className="text-lg font-bold text-muted-foreground">
              <span>-{formatCurrency(matter.totalDisbursements)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matter Details & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Matter Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Link href={`/clients/${matter.clientId}`} className="font-medium text-primary hover:underline">
                    {matter.clientName}
                  </Link>
                </div>
                {matter.clientEmail && (
                  <p className="text-sm text-muted-foreground ml-6">{matter.clientEmail}</p>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Practice Area</p>
                <p className="font-medium">{matter.practiceArea || '-'}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Responsible Attorney</p>
                <p className="font-medium">{matter.responsibleAttorney || '-'}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Opened</p>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatDate(matter.openDate)}</span>
                </div>
              </div>

              {matter.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm mt-1">{matter.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Matter Actions */}
          <MatterActions 
            matter={{
              id: matter.id,
              name: matter.name,
              description: matter.description,
              practiceArea: matter.practiceArea,
              responsibleAttorney: matter.responsibleAttorney,
              status: matter.status,
            }}
            balance={matter.balance}
          />
        </div>

        {/* Right Column - AI Analysis & Transaction Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Document Analysis - Moved above transaction form */}
          <DocumentAnalyzer 
            matterId={matter.id} 
            matterStatus={matter.status || 'open'}
          />

          {/* Transaction Form */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Record Transaction</CardTitle>
              <CardDescription>Add a deposit or disbursement to this matter</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <TransactionForm 
                matterId={matter.id} 
                currentBalance={matter.availableBalance}
                matterStatus={matter.status || 'open'}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Holds Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 items-start">
        {/* Create Hold */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Create Hold
            </CardTitle>
            <CardDescription>
              Place a hold on funds for this matter
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matter.status === 'closed' ? (
              <p className="text-muted-foreground text-sm">Cannot create holds on a closed matter</p>
            ) : (
              <HoldForm 
                matterId={matter.id} 
                availableBalance={matter.availableBalance}
              />
            )}
          </CardContent>
        </Card>

        {/* Holds List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Holds
            </CardTitle>
            <CardDescription>
              Active and released holds on this matter
            </CardDescription>
          </CardHeader>
          <CardContent className={matter.holds.length > 2 ? "max-h-[400px] overflow-y-auto" : ""}>
            <HoldList holds={matter.holds} matterId={matter.id} />
          </CardContent>
        </Card>
      </div>

      {/* Ledger */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Trust Account Ledger
          </CardTitle>
          <CardDescription>
            Complete transaction history for this matter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matter.transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No transactions yet</p>
              <p className="text-sm mt-1">Record a deposit to get started</p>
            </div>
          ) : (
            <Table className="ledger-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matter.transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(txn.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{txn.description}</p>
                        {txn.type === 'deposit' && txn.payor && (
                          <p className="text-xs text-muted-foreground">From: {txn.payor}</p>
                        )}
                        {txn.type === 'disbursement' && txn.payee && (
                          <p className="text-xs text-muted-foreground">To: {txn.payee}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {txn.checkNumber || txn.reference || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono amount debit">
                      {txn.type === 'disbursement' ? formatCurrency(txn.amount) : ''}
                    </TableCell>
                    <TableCell className="text-right font-mono amount credit">
                      {txn.type === 'deposit' ? formatCurrency(txn.amount) : ''}
                    </TableCell>
                    <TableCell className="text-right font-mono amount balance">
                      {formatCurrency(txn.runningBalance)}
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
