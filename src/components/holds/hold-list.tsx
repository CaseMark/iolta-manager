"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Unlock, Loader2, Lock } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Hold {
  id: string;
  amount: number;
  type: string;
  description: string;
  status: string | null;
  createdAt: Date;
  releasedAt: Date | null;
  releaseReason: string | null;
}

interface HoldListProps {
  holds: Hold[];
  matterId: string;
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

function HoldItem({ hold, onRelease }: { hold: Hold; onRelease: () => void }) {
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseReason, setReleaseReason] = useState("");
  const [releaseAmount, setReleaseAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRelease = async () => {
    if (!releaseReason.trim()) {
      setError("Release reason is required");
      return;
    }

    const amountToRelease = releaseAmount ? parseFloat(releaseAmount) * 100 : hold.amount;
    
    if (amountToRelease <= 0) {
      setError("Release amount must be greater than 0");
      return;
    }
    
    if (amountToRelease > hold.amount) {
      setError(`Release amount cannot exceed hold amount (${formatCurrency(hold.amount)})`);
      return;
    }

    setReleasing(true);
    setError(null);

    try {
      const response = await fetch(`/api/holds/${hold.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          releaseReason,
          releaseAmount: amountToRelease,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to release hold");
      }

      setShowReleaseForm(false);
      setReleaseReason("");
      setReleaseAmount("");
      router.refresh();
      onRelease();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release hold");
    } finally {
      setReleasing(false);
    }
  };

  const isActive = hold.status === 'active';

  return (
    <div className={`border rounded-lg p-4 ${isActive ? 'bg-card' : 'bg-muted'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {getHoldTypeBadge(hold.type)}
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {hold.status}
            </Badge>
          </div>
          <p className="font-medium">{hold.description}</p>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(hold.createdAt)}
            {hold.releasedAt && ` • Released ${formatDate(hold.releasedAt)}`}
          </p>
          {hold.releaseReason && (
            <p className="text-sm text-muted-foreground mt-1">
              Reason: {hold.releaseReason}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold font-mono">
            {formatCurrency(hold.amount)}
          </p>
          {isActive && !showReleaseForm && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setShowReleaseForm(true)}
            >
              <Unlock className="h-3 w-3 mr-1" />
              Release
            </Button>
          )}
        </div>
      </div>

      {showReleaseForm && (
        <div className="mt-4 pt-4 border-t space-y-3">
          {error && (
            <div className="bg-neutral-100 border border-neutral-200 text-foreground px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`release-amount-${hold.id}`}>Release Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id={`release-amount-${hold.id}`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={hold.amount / 100}
                  value={releaseAmount}
                  onChange={(e) => setReleaseAmount(e.target.value)}
                  placeholder={(hold.amount / 100).toFixed(2)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Max: {formatCurrency(hold.amount)} (leave blank for full amount)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`release-reason-${hold.id}`}>Release Reason *</Label>
              <Input
                id={`release-reason-${hold.id}`}
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="Enter reason for releasing"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleRelease}
              disabled={releasing}
            >
              {releasing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Releasing...
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3 mr-1" />
                  Release {releaseAmount ? formatCurrency(parseFloat(releaseAmount) * 100) : formatCurrency(hold.amount)}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowReleaseForm(false);
                setReleaseReason("");
                setReleaseAmount("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function HoldList({ holds, matterId }: HoldListProps) {
  const activeHolds = holds.filter(h => h.status === 'active');
  const releasedHolds = holds.filter(h => h.status !== 'active');

  if (holds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        <p>No holds on this matter</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeHolds.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Active Holds</h4>
          {activeHolds.map((hold) => (
            <HoldItem key={hold.id} hold={hold} onRelease={() => {}} />
          ))}
        </div>
      )}

      {releasedHolds.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Released/Cancelled Holds</h4>
          {releasedHolds.map((hold) => (
            <HoldItem key={hold.id} hold={hold} onRelease={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}
