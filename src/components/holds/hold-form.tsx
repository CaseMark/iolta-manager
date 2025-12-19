"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Lock, Loader2 } from "lucide-react";

interface HoldFormProps {
  matterId: string;
  availableBalance: number;
  onSuccess?: () => void;
}

export function HoldForm({ matterId, availableBalance, onSuccess }: HoldFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    amount: "",
    type: "retainer",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const amountInCents = Math.round(parseFloat(formData.amount) * 100);

    if (isNaN(amountInCents) || amountInCents <= 0) {
      setError("Please enter a valid amount");
      setLoading(false);
      return;
    }

    if (amountInCents > availableBalance) {
      setError(`Amount exceeds available balance of $${(availableBalance / 100).toFixed(2)}`);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matterId,
          amount: amountInCents,
          type: formData.type,
          description: formData.description,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create hold");
      }

      setFormData({ amount: "", type: "retainer", description: "" });
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create hold");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-neutral-100 border border-neutral-200 text-foreground px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="holdAmount">Amount ($)</Label>
          <Input
            id="holdAmount"
            type="number"
            step="0.01"
            min="0.01"
            max={availableBalance / 100}
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="holdType">Hold Type</Label>
          <Select
            id="holdType"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            required
          >
            <option value="retainer">Retainer</option>
            <option value="settlement">Settlement</option>
            <option value="escrow">Escrow</option>
            <option value="compliance">Compliance</option>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="holdDescription">Description</Label>
        <Input
          id="holdDescription"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Reason for hold"
          required
        />
      </div>

      <Button type="submit" disabled={loading || availableBalance <= 0} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Creating Hold...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Create Hold
          </>
        )}
      </Button>

      {availableBalance <= 0 && (
        <p className="text-sm text-muted-foreground text-center">
          No available balance to place a hold
        </p>
      )}
    </form>
  );
}
