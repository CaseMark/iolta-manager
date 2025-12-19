"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, Save } from "lucide-react";
import { formatCurrency, parseCurrency } from "@/lib/utils";

interface TransactionFormProps {
  matterId: string;
  currentBalance: number;
  matterStatus: string;
}

export function TransactionForm({ matterId, currentBalance, matterStatus }: TransactionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<'deposit' | 'disbursement'>('deposit');

  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    payor: "",
    payee: "",
    checkNumber: "",
    reference: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const amountInCents = parseCurrency(formData.amount);

      if (amountInCents <= 0) {
        throw new Error("Amount must be greater than zero");
      }

      if (transactionType === 'disbursement' && amountInCents > currentBalance) {
        throw new Error(`Insufficient funds. Available balance: ${formatCurrency(currentBalance)}`);
      }

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId,
          type: transactionType,
          amount: amountInCents,
          description: formData.description,
          payor: transactionType === 'deposit' ? formData.payor : null,
          payee: transactionType === 'disbursement' ? formData.payee : null,
          checkNumber: formData.checkNumber || null,
          reference: formData.reference || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create transaction");
      }

      setSuccess(`${transactionType === 'deposit' ? 'Deposit' : 'Disbursement'} recorded successfully!`);
      setFormData({
        amount: "",
        description: "",
        payor: "",
        payee: "",
        checkNumber: "",
        reference: "",
      });

      // Refresh the page to show updated data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (matterStatus === 'closed') {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>This matter is closed. No new transactions can be recorded.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-neutral-100 text-foreground p-3 rounded-md text-sm border border-neutral-200">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-neutral-100 text-foreground p-3 rounded-md text-sm border border-neutral-200">
          {success}
        </div>
      )}

      {/* Transaction Type Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={transactionType === 'deposit' ? 'default' : 'outline'}
          onClick={() => setTransactionType('deposit')}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Deposit
        </Button>
        <Button
          type="button"
          variant={transactionType === 'disbursement' ? 'default' : 'outline'}
          onClick={() => setTransactionType('disbursement')}
        >
          <TrendingDown className="h-4 w-4 mr-2" />
          Disbursement
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="amount"
              type="text"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              className="pl-7"
              required
            />
          </div>
          {transactionType === 'disbursement' && (
            <p className="text-xs text-muted-foreground">
              Available: {formatCurrency(currentBalance)}
            </p>
          )}
        </div>

        {/* Check Number / Reference */}
        <div className="space-y-2">
          <Label htmlFor="checkNumber">Check # / Reference</Label>
          <Input
            id="checkNumber"
            value={formData.checkNumber}
            onChange={(e) => setFormData({ ...formData, checkNumber: e.target.value })}
            placeholder="1234"
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={transactionType === 'deposit' ? "Initial retainer" : "Payment to vendor"}
          required
        />
      </div>

      {/* Payor (for deposits) */}
      {transactionType === 'deposit' && (
        <div className="space-y-2">
          <Label htmlFor="payor">Received From</Label>
          <Input
            id="payor"
            value={formData.payor}
            onChange={(e) => setFormData({ ...formData, payor: e.target.value })}
            placeholder="Client name or source"
          />
        </div>
      )}

      {/* Payee (for disbursements) */}
      {transactionType === 'disbursement' && (
        <div className="space-y-2">
          <Label htmlFor="payee">Pay To</Label>
          <Input
            id="payee"
            value={formData.payee}
            onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
            placeholder="Vendor or recipient name"
          />
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {loading ? "Recording..." : `Record ${transactionType === 'deposit' ? 'Deposit' : 'Disbursement'}`}
      </Button>
    </form>
  );
}
