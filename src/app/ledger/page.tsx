'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { BookOpen, Filter } from "lucide-react";
import Link from "next/link";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Transaction {
  id: string;
  matterId: string;
  type: string;
  amount: number;
  description: string;
  payee: string | null;
  payor: string | null;
  checkNumber: string | null;
  reference: string | null;
  status: string | null;
  createdAt: string;
  matterName: string | null;
  matterNumber: string | null;
  clientId: string | null;
  clientName: string | null;
  runningBalance?: number;
}

interface Client {
  id: string;
  name: string;
}

export default function LedgerPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [txnRes, clientsRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/clients'),
      ]);
      
      const txnData = await txnRes.json();
      const clientsData = await clientsRes.json();
      
      setTransactions(txnData);
      setClients(clientsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions by selected client and calculate running balance
  const { filteredTransactions, totals } = useMemo(() => {
    let filtered = transactions;
    
    if (selectedClientId) {
      filtered = transactions.filter(t => t.clientId === selectedClientId);
    }

    // Calculate running balance for filtered transactions
    let runningBalance = 0;
    const withBalance = [...filtered].reverse().map((txn) => {
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

    // Calculate totals
    const totalDeposits = filtered
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalDisbursements = filtered
      .filter(t => t.type === 'disbursement')
      .reduce((sum, t) => sum + t.amount, 0);
    const trustBalance = totalDeposits - totalDisbursements;

    return {
      filteredTransactions: withBalance,
      totals: {
        totalDeposits,
        totalDisbursements,
        trustBalance,
        transactionCount: filtered.length,
      },
    };
  }, [transactions, selectedClientId]);

  const selectedClient = selectedClientId
    ? clients.find(c => c.id === selectedClientId)
    : null;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Trust Account Ledger</h1>
          <p className="text-muted-foreground mt-1">
            {selectedClient 
              ? `Transaction history for ${selectedClient.name}`
              : 'Complete transaction history across all matters'
            }
          </p>
        </div>
      </div>

      {/* Client Filter */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter by Client
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedClientId || ""}
            onChange={(e) => setSelectedClientId(e.target.value || null)}
            className="w-[280px]"
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {selectedClient ? `${selectedClient.name} Balance` : 'Trust Balance'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.trustBalance < 0 ? 'text-muted-foreground' : ''}`}>
              {formatCurrency(totals.trustBalance)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deposits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals.totalDeposits)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Disbursements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {formatCurrency(totals.totalDisbursements)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.transactionCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {selectedClient ? `${selectedClient.name} Ledger` : 'Transaction Ledger'}
          </CardTitle>
          <CardDescription>
            {selectedClient 
              ? `All transactions for ${selectedClient.name}`
              : 'All trust account transactions in chronological order'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">
                {selectedClient ? `No transactions for ${selectedClient.name}` : 'No transactions yet'}
              </p>
              <p className="text-sm mt-1">
                {selectedClient 
                  ? 'This client has no recorded transactions'
                  : 'Create a matter and record transactions to see them here'
                }
              </p>
            </div>
          ) : (
            <Table className="ledger-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Matter</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(txn.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link 
                        href={`/matters/${txn.matterId}`}
                        className="hover:text-primary hover:underline"
                      >
                        <div>
                          <p className="font-medium">{txn.matterName}</p>
                          {!selectedClient && (
                            <p className="text-xs text-muted-foreground">{txn.clientName}</p>
                          )}
                        </div>
                      </Link>
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
                      {formatCurrency(txn.runningBalance || 0)}
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
