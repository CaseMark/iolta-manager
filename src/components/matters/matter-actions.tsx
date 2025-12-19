"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { MatterEditForm } from "./matter-edit-form";

interface MatterActionsProps {
  matter: {
    id: string;
    name: string;
    description: string | null;
    practiceArea: string | null;
    responsibleAttorney: string | null;
    status: string | null;
  };
  balance: number;
}

export function MatterActions({ matter, balance }: MatterActionsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = async () => {
    setIsClosing(true);
    setError(null);

    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to close matter");
      }

      router.push("/matters");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close matter");
      setShowCloseConfirm(false);
    } finally {
      setIsClosing(false);
    }
  };

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Matter
          </CardTitle>
          <CardDescription>Update matter details</CardDescription>
        </CardHeader>
        <CardContent>
          <MatterEditForm
            matter={matter}
            onCancel={() => setIsEditing(false)}
            onSave={() => setIsEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  if (showCloseConfirm) {
    return (
      <Card className="border-neutral-300 bg-neutral-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Close Matter
          </CardTitle>
          <CardDescription>
            Are you sure you want to close this matter?
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-neutral-100 border border-neutral-300 text-foreground px-4 py-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          
          {balance !== 0 && (
            <div className="bg-neutral-100 border border-neutral-300 text-foreground px-4 py-3 rounded mb-4 text-sm">
              <strong>Warning:</strong> This matter has a balance of ${(balance / 100).toFixed(2)}. 
              You must disburse all funds before closing.
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-4">
            Closing a matter will mark it as closed and prevent any new transactions. 
            This action can be reversed by editing the matter status.
          </p>

          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleClose}
              disabled={isClosing || balance !== 0}
            >
              {isClosing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Closing...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Yes, Close Matter
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowCloseConfirm(false)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matter Actions</CardTitle>
        <CardDescription>Manage this matter</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setIsEditing(true)}
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit Matter Details
        </Button>
        
        {matter.status === 'open' && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => setShowCloseConfirm(true)}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Close Matter
          </Button>
        )}

        {matter.status === 'closed' && (
          <div className="text-sm text-muted-foreground p-3 bg-muted rounded">
            This matter is closed. Edit the matter to reopen it.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
