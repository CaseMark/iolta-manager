"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, CheckCircle, Upload, X, Eye, EyeOff, Info } from "lucide-react";

// All US states
const ALL_US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 
  'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'
];

// States with specific IOLTA rules (defined inline to avoid import issues)
const SUPPORTED_STATES = [
  'Alabama', 'California', 'Colorado', 'Florida', 'Georgia', 
  'Illinois', 'Massachusetts', 'New York', 'Pennsylvania', 'Texas', 'Washington'
];

// Bar association names
const BAR_ASSOCIATIONS: Record<string, string> = {
  'Alabama': 'Alabama State Bar',
  'California': 'State Bar of California',
  'Colorado': 'Colorado Bar Association',
  'Florida': 'The Florida Bar',
  'Georgia': 'State Bar of Georgia',
  'Illinois': 'Illinois State Bar Association',
  'Massachusetts': 'Massachusetts Bar Association',
  'New York': 'New York State Bar Association',
  'Pennsylvania': 'Pennsylvania Bar Association',
  'Texas': 'State Bar of Texas',
  'Washington': 'Washington State Bar Association',
};

interface Settings {
  id: string;
  firmName: string | null;
  firmLogo: string | null;
  bankName: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  state: string | null;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showRoutingNumber, setShowRoutingNumber] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    firmName: "",
    firmLogo: "",
    bankName: "",
    accountNumber: "",
    routingNumber: "",
    state: "",
  });

  // Track if account numbers have been modified
  const [accountModified, setAccountModified] = useState(false);
  const [routingModified, setRoutingModified] = useState(false);
  const [originalAccountMasked, setOriginalAccountMasked] = useState("");
  const [originalRoutingMasked, setOriginalRoutingMasked] = useState("");

  // Check if the entered state is supported
  const stateComplianceInfo = useMemo(() => {
    if (!formData.state) return null;
    
    const isSupported = SUPPORTED_STATES.includes(formData.state);
    
    return {
      isSupported,
      stateName: formData.state,
      barAssociation: isSupported ? BAR_ASSOCIATIONS[formData.state] : null,
    };
  }, [formData.state]);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          if (data) {
            // Mask account numbers for display
            const maskedAccount = data.accountNumber 
              ? "••••" + data.accountNumber.slice(-4) 
              : "";
            const maskedRouting = data.routingNumber 
              ? "••••" + data.routingNumber.slice(-4) 
              : "";
            
            setOriginalAccountMasked(maskedAccount);
            setOriginalRoutingMasked(maskedRouting);
            
            setFormData({
              firmName: data.firmName || "",
              firmLogo: data.firmLogo || "",
              bankName: data.bankName || "",
              accountNumber: maskedAccount,
              routingNumber: maskedRouting,
              state: data.state || "",
            });
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      // Only send account/routing if they were modified
      const dataToSend = {
        firmName: formData.firmName,
        firmLogo: formData.firmLogo,
        bankName: formData.bankName,
        state: formData.state,
        // Only include if modified (not the masked value)
        ...(accountModified && { accountNumber: formData.accountNumber }),
        ...(routingModified && { routingNumber: formData.routingNumber }),
      };

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      
      // Reset modification flags
      setAccountModified(false);
      setRoutingModified(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 500KB)
    if (file.size > 500 * 1024) {
      setError('Logo must be less than 500KB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData({ ...formData, firmLogo: base64 });
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setFormData({ ...formData, firmLogo: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAccountNumberChange = (value: string) => {
    setAccountModified(true);
    setFormData({ ...formData, accountNumber: value });
  };

  const handleRoutingNumberChange = (value: string) => {
    setRoutingModified(true);
    setFormData({ ...formData, routingNumber: value });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your trust account settings</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 max-w-2xl">
          {error && (
            <div className="bg-neutral-100 border border-neutral-300 text-foreground px-4 py-3 rounded">
              {error}
            </div>
          )}

          {saved && (
            <div className="bg-neutral-100 border border-neutral-300 text-foreground px-4 py-3 rounded flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Settings saved successfully
            </div>
          )}

          {/* Firm Information */}
          <Card>
            <CardHeader>
              <CardTitle>Firm Information</CardTitle>
              <CardDescription>
                Your law firm details for reports and compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="firmName">Firm Name</Label>
                <Input 
                  id="firmName" 
                  value={formData.firmName}
                  onChange={(e) => setFormData({ ...formData, firmName: e.target.value })}
                  placeholder="Enter your firm name"
                />
                <p className="text-xs text-muted-foreground">
                  This name will appear in the sidebar and on reports
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State Bar Jurisdiction</Label>
                <select
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a state...</option>
                  {ALL_US_STATES.map(state => (
                    <option key={state} value={state}>
                      {state} {SUPPORTED_STATES.includes(state) ? '✓' : ''}
                    </option>
                  ))}
                </select>
                {stateComplianceInfo && (
                  stateComplianceInfo.isSupported ? (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-green-800">
                            State-specific rules available
                          </p>
                          <p className="text-green-700 mt-1">
                            Reports will include {stateComplianceInfo.stateName}-specific IOLTA compliance requirements 
                            from the {stateComplianceInfo.barAssociation}.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-800">
                            Using general IOLTA guidelines
                          </p>
                          <p className="text-amber-700 mt-1">
                            State-specific rules for &quot;{formData.state}&quot; are not yet available. 
                            Reports will use ABA Model Rules as a baseline. Always verify requirements 
                            with your state bar association.
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Firm Logo Upload */}
              <div className="space-y-3">
                <Label>Firm Logo</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <div className="flex items-start gap-4">
                  {formData.firmLogo ? (
                    <div className="relative flex-shrink-0">
                      <img 
                        src={formData.firmLogo} 
                        alt="Firm logo" 
                        className="h-14 w-14 object-contain rounded-lg border bg-white p-1"
                      />
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute -top-2 -right-2 p-1 bg-neutral-800 text-white rounded-full hover:bg-neutral-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label 
                      htmlFor="logo-upload"
                      className="h-14 w-14 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted flex-shrink-0 cursor-pointer hover:bg-muted/80 hover:border-neutral-400 transition-colors"
                    >
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </label>
                  )}
                  <div className="flex flex-col gap-1">
                    {formData.firmLogo ? (
                      <label htmlFor="logo-upload">
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Change Logo
                          </span>
                        </Button>
                      </label>
                    ) : (
                      <label htmlFor="logo-upload" className="text-sm font-medium text-foreground cursor-pointer hover:underline">
                        Upload Logo
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, or SVG. Max 500KB.<br />
                      Will appear in the sidebar.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>Trust Account Details</CardTitle>
              <CardDescription>
                Your IOLTA trust account banking information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input 
                  id="bankName" 
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  placeholder="Enter bank name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <div className="relative">
                    <Input 
                      id="accountNumber" 
                      value={formData.accountNumber}
                      onChange={(e) => handleAccountNumberChange(e.target.value)}
                      placeholder="Enter account number"
                      type={showAccountNumber ? "text" : "password"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccountNumber(!showAccountNumber)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showAccountNumber ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stored securely. Only last 4 digits shown.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="routingNumber">Routing Number</Label>
                  <div className="relative">
                    <Input 
                      id="routingNumber" 
                      value={formData.routingNumber}
                      onChange={(e) => handleRoutingNumberChange(e.target.value)}
                      placeholder="Enter routing number"
                      type={showRoutingNumber ? "text" : "password"}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRoutingNumber(!showRoutingNumber)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showRoutingNumber ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stored securely. Only last 4 digits shown.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>

          {/* Info Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-primary mb-2">About IOLTA Compliance</h3>
              <p className="text-sm text-foreground/80 mb-4">
                IOLTA (Interest on Lawyer Trust Accounts) accounts are required by state bar associations 
                to hold client funds separately from firm operating funds. This application helps you 
                maintain proper records, generate compliance reports, and ensure ethical handling of 
                client funds in accordance with your state bar rules.
              </p>
              <div className="border-t border-primary/20 pt-4">
                <h4 className="font-medium text-primary text-sm mb-2">State-Specific Rules Available</h4>
                <p className="text-xs text-foreground/70 mb-2">
                  Reports include detailed compliance requirements for these jurisdictions:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPORTED_STATES.map(state => (
                    <span 
                      key={state}
                      className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                    >
                      {state}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-foreground/60 mt-2">
                  Other states will use ABA Model Rules as a baseline.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
