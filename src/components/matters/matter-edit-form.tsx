"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, Loader2 } from "lucide-react";

interface MatterEditFormProps {
  matter: {
    id: string;
    name: string;
    description: string | null;
    practiceArea: string | null;
    responsibleAttorney: string | null;
    status: string | null;
  };
  onCancel: () => void;
  onSave: () => void;
}

export function MatterEditForm({ matter, onCancel, onSave }: MatterEditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: matter.name || "",
    description: matter.description || "",
    practiceArea: matter.practiceArea || "",
    responsibleAttorney: matter.responsibleAttorney || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/matters/${matter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update matter");
      }

      onSave();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update matter");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-neutral-100 border border-neutral-200 text-foreground px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Matter Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter matter name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of the matter"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="practiceArea">Practice Area</Label>
          <Select
            id="practiceArea"
            value={formData.practiceArea}
            onChange={(e) => setFormData({ ...formData, practiceArea: e.target.value })}
          >
            <option value="">Select practice area</option>
            <option value="litigation">Litigation</option>
            <option value="corporate">Corporate</option>
            <option value="family">Family Law</option>
            <option value="real_estate">Real Estate</option>
            <option value="estate_planning">Estate Planning</option>
            <option value="criminal">Criminal Defense</option>
            <option value="immigration">Immigration</option>
            <option value="bankruptcy">Bankruptcy</option>
            <option value="personal_injury">Personal Injury</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsibleAttorney">Responsible Attorney</Label>
          <Input
            id="responsibleAttorney"
            value={formData.responsibleAttorney}
            onChange={(e) => setFormData({ ...formData, responsibleAttorney: e.target.value })}
            placeholder="Attorney name"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} size="sm">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </form>
  );
}
