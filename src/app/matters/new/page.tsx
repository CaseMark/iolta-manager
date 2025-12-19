"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Save, 
  Briefcase, 
  Plus, 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
}

interface ExtractedTransaction {
  date: string;
  type: 'deposit' | 'disbursement';
  category?: string;
  description: string;
  amount: number;
  payee?: string;
  payor?: string;
  checkNumber?: string;
  reference?: string;
}

interface ExtractedHold {
  type: string;
  amount: number;
  description: string;
  status: 'active' | 'released';
  createdDate?: string;
  notes?: string;
}

interface ExtractedData {
  matter: {
    name: string;
    matterNumber?: string;
    matterType?: string;
    description?: string;
    status?: string;
    openDate?: string;
    responsibleAttorney?: string;
    practiceArea?: string;
  };
  client: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  financialSummary?: {
    trustBalance?: number;
    totalDeposits?: number;
    totalDisbursements?: number;
    activeHolds?: number;
    availableBalance?: number;
  };
  transactions: ExtractedTransaction[];
  holds: ExtractedHold[];
}

const practiceAreas = [
  "Litigation",
  "Corporate",
  "Real Estate",
  "Family Law",
  "Estate Planning",
  "Criminal Defense",
  "Immigration",
  "Intellectual Property",
  "Employment",
  "Bankruptcy",
  "Personal Injury",
  "Other",
];

export default function NewMatterPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  
  // Manual form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [createNewClient, setCreateNewClient] = useState(false);

  const [formData, setFormData] = useState({
    clientId: "",
    name: "",
    description: "",
    practiceArea: "",
    responsibleAttorney: "",
  });

  const [newClientData, setNewClientData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // Import state
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showHolds, setShowHolds] = useState(false);
  const [useExistingClient, setUseExistingClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    // Fetch existing clients
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => setClients(data))
      .catch(console.error);
  }, []);

  // Manual form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        description: formData.description,
        practiceArea: formData.practiceArea,
        responsibleAttorney: formData.responsibleAttorney,
      };

      if (createNewClient) {
        payload.newClient = newClientData;
      } else {
        payload.clientId = formData.clientId;
      }

      const response = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create matter");
      }

      const matter = await response.json();
      router.push(`/matters/${matter.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // File selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setExtractedData(null);
      setImportError(null);
    }
  };

  // Process uploaded file
  const handleProcessFile = async () => {
    if (!selectedFile) return;

    setImportLoading(true);
    setImportError(null);
    setExtractedData(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/matters/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process document');
      }

      setExtractedData(result.data);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to process document');
    } finally {
      setImportLoading(false);
    }
  };

  // Confirm and save imported data
  const handleConfirmImport = async () => {
    if (!extractedData) return;

    setConfirmLoading(true);
    setImportError(null);

    try {
      const response = await fetch('/api/matters/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...extractedData,
          useExistingClient,
          existingClientId: useExistingClient ? selectedClientId : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save imported matter');
      }

      router.push(`/matters/${result.matter.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to save imported matter');
    } finally {
      setConfirmLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/matters">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">New Matter</h1>
          <p className="text-muted-foreground mt-1">Create a new client matter with trust account</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 max-w-2xl">
        <Button
          variant={activeTab === 'manual' ? 'default' : 'outline'}
          onClick={() => setActiveTab('manual')}
          className="flex-1"
        >
          <Briefcase className="h-4 w-4 mr-2" />
          Manual Entry
        </Button>
        <Button
          variant={activeTab === 'import' ? 'default' : 'outline'}
          onClick={() => setActiveTab('import')}
          className="flex-1"
        >
          <Upload className="h-4 w-4 mr-2" />
          Import from Document
        </Button>
      </div>

      {/* Manual Entry Tab */}
      {activeTab === 'manual' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Matter Information
            </CardTitle>
            <CardDescription>
              Enter the matter details and select or create a client
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-neutral-100 text-foreground p-3 rounded-md text-sm border border-neutral-200">
                  {error}
                </div>
              )}

              {/* Client Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Client</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreateNewClient(!createNewClient)}
                  >
                    {createNewClient ? "Select Existing" : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        New Client
                      </>
                    )}
                  </Button>
                </div>

                {createNewClient ? (
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="newClientName">Client Name *</Label>
                      <Input
                        id="newClientName"
                        value={newClientData.name}
                        onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                        placeholder="John Smith"
                        required={createNewClient}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newClientEmail">Email</Label>
                        <Input
                          id="newClientEmail"
                          type="email"
                          value={newClientData.email}
                          onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                          placeholder="john@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newClientPhone">Phone</Label>
                        <Input
                          id="newClientPhone"
                          value={newClientData.phone}
                          onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    required={!createNewClient}
                  >
                    <option value="">Select a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {/* Matter Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Matter Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Smith v. Jones"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Typically the case name or a brief description of the matter
                </p>
              </div>

              {/* Practice Area */}
              <div className="space-y-2">
                <Label htmlFor="practiceArea">Practice Area</Label>
                <Select
                  value={formData.practiceArea}
                  onChange={(e) => setFormData({ ...formData, practiceArea: e.target.value })}
                >
                  <option value="">Select practice area...</option>
                  {practiceAreas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Responsible Attorney */}
              <div className="space-y-2">
                <Label htmlFor="responsibleAttorney">Responsible Attorney</Label>
                <Input
                  id="responsibleAttorney"
                  value={formData.responsibleAttorney}
                  onChange={(e) => setFormData({ ...formData, responsibleAttorney: e.target.value })}
                  placeholder="Jane Doe"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the matter..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Creating..." : "Create Matter"}
                </Button>
                <Link href="/matters">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="max-w-4xl space-y-6">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Matter from Document
              </CardTitle>
              <CardDescription>
                Upload a matter/transaction history document (PDF, TXT, or DOCX) and we&apos;ll use AI to extract the data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {importError && (
                <div className="bg-neutral-100 border border-neutral-200 text-foreground p-3 rounded-md text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* File Upload Area */}
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  selectedFile ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-muted-foreground'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.docx,.doc"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setExtractedData(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-muted-foreground">
                      PDF, TXT, or DOCX files supported
                    </p>
                  </>
                )}
              </div>

              {/* Process Button */}
              {selectedFile && !extractedData && (
                <Button
                  onClick={handleProcessFile}
                  disabled={importLoading}
                  className="w-full"
                >
                  {importLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing with AI...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Extract Data from Document
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Extracted Data Preview */}
          {extractedData && (
            <>
              {/* Matter Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Extracted Matter Details
                  </CardTitle>
                  <CardDescription>
                    Review the extracted information before importing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Matter Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Matter Name</Label>
                      <p className="font-medium">{extractedData.matter.name}</p>
                    </div>
                    {extractedData.matter.matterNumber && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Matter Number</Label>
                        <p className="font-medium">{extractedData.matter.matterNumber}</p>
                      </div>
                    )}
                    {extractedData.matter.practiceArea && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Practice Area</Label>
                        <p className="font-medium">{extractedData.matter.practiceArea}</p>
                      </div>
                    )}
                    {extractedData.matter.responsibleAttorney && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Responsible Attorney</Label>
                        <p className="font-medium">{extractedData.matter.responsibleAttorney}</p>
                      </div>
                    )}
                    {extractedData.matter.openDate && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Open Date</Label>
                        <p className="font-medium">{extractedData.matter.openDate}</p>
                      </div>
                    )}
                    {extractedData.matter.status && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Status</Label>
                        <Badge variant={extractedData.matter.status === 'Active' ? 'default' : 'secondary'}>
                          {extractedData.matter.status}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {extractedData.matter.description && (
                    <div>
                      <Label className="text-muted-foreground text-xs">Description</Label>
                      <p className="text-sm">{extractedData.matter.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Client Selection Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Client Information</CardTitle>
                  <CardDescription>
                    Choose to create a new client or link to an existing one
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Button
                      type="button"
                      variant={!useExistingClient ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUseExistingClient(false)}
                    >
                      Create New Client
                    </Button>
                    <Button
                      type="button"
                      variant={useExistingClient ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUseExistingClient(true)}
                    >
                      Use Existing Client
                    </Button>
                  </div>

                  {useExistingClient ? (
                    <Select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                    >
                      <option value="">Select a client...</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">Client Name</Label>
                          <p className="font-medium">{extractedData.client.name}</p>
                        </div>
                        {extractedData.client.email && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Email</Label>
                            <p className="font-medium">{extractedData.client.email}</p>
                          </div>
                        )}
                        {extractedData.client.phone && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Phone</Label>
                            <p className="font-medium">{extractedData.client.phone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial Summary Card */}
              {extractedData.financialSummary && (
                <Card>
                  <CardHeader>
                    <CardTitle>Financial Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {extractedData.financialSummary.trustBalance !== undefined && (
                        <div className="text-center p-3 bg-primary/10 rounded-lg">
                          <p className="text-xs text-muted-foreground">Trust Balance</p>
                          <p className="font-bold text-primary">
                            {formatCurrency(extractedData.financialSummary.trustBalance)}
                          </p>
                        </div>
                      )}
                      {extractedData.financialSummary.totalDeposits !== undefined && (
                        <div className="text-center p-3 bg-neutral-100 rounded-lg">
                          <p className="text-xs text-muted-foreground">Total Deposits</p>
                          <p className="font-bold text-foreground">
                            {formatCurrency(extractedData.financialSummary.totalDeposits)}
                          </p>
                        </div>
                      )}
                      {extractedData.financialSummary.totalDisbursements !== undefined && (
                        <div className="text-center p-3 bg-neutral-100 rounded-lg">
                          <p className="text-xs text-muted-foreground">Total Disbursements</p>
                          <p className="font-bold text-foreground">
                            {formatCurrency(extractedData.financialSummary.totalDisbursements)}
                          </p>
                        </div>
                      )}
                      {extractedData.financialSummary.activeHolds !== undefined && (
                        <div className="text-center p-3 bg-neutral-100 rounded-lg">
                          <p className="text-xs text-muted-foreground">Active Holds</p>
                          <p className="font-bold text-foreground">
                            {formatCurrency(extractedData.financialSummary.activeHolds)}
                          </p>
                        </div>
                      )}
                      {extractedData.financialSummary.availableBalance !== undefined && (
                        <div className="text-center p-3 bg-primary/5 rounded-lg">
                          <p className="text-xs text-muted-foreground">Available</p>
                          <p className="font-bold text-primary">
                            {formatCurrency(extractedData.financialSummary.availableBalance)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Transactions Card */}
              {extractedData.transactions.length > 0 && (
                <Card>
                  <CardHeader 
                    className="cursor-pointer"
                    onClick={() => setShowTransactions(!showTransactions)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Transactions
                          <Badge variant="secondary">{extractedData.transactions.length}</Badge>
                        </CardTitle>
                        <CardDescription>
                          {extractedData.transactions.filter(t => t.type === 'deposit').length} deposits, {' '}
                          {extractedData.transactions.filter(t => t.type === 'disbursement').length} disbursements
                        </CardDescription>
                      </div>
                      {showTransactions ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  {showTransactions && (
                    <CardContent>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {extractedData.transactions.map((txn, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant={txn.type === 'deposit' ? 'default' : 'destructive'}>
                                {txn.type}
                              </Badge>
                              <div>
                                <p className="font-medium text-sm">{txn.description}</p>
                                <p className="text-xs text-muted-foreground">{txn.date}</p>
                              </div>
                            </div>
                            <p className={`font-bold ${txn.type === 'deposit' ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {txn.type === 'deposit' ? '+' : '-'}{formatCurrency(txn.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Holds Card */}
              {extractedData.holds.length > 0 && (
                <Card>
                  <CardHeader 
                    className="cursor-pointer"
                    onClick={() => setShowHolds(!showHolds)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Holds
                          <Badge variant="secondary">{extractedData.holds.length}</Badge>
                        </CardTitle>
                        <CardDescription>
                          {extractedData.holds.filter(h => h.status === 'active').length} active holds
                        </CardDescription>
                      </div>
                      {showHolds ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  {showHolds && (
                    <CardContent>
                      <div className="space-y-2">
                        {extractedData.holds.map((hold, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant={hold.status === 'active' ? 'default' : 'secondary'}>
                                {hold.status}
                              </Badge>
                              <div>
                                <p className="font-medium text-sm">{hold.description}</p>
                                <p className="text-xs text-muted-foreground">{hold.type}</p>
                              </div>
                            </div>
                            <p className="font-bold text-foreground">
                              {formatCurrency(hold.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmImport}
                  disabled={confirmLoading || (useExistingClient && !selectedClientId)}
                  className="flex-1"
                >
                  {confirmLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm & Import Matter
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtractedData(null);
                    setSelectedFile(null);
                  }}
                >
                  Start Over
                </Button>
              </div>
            </>
          )}

          {/* Info Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-primary mb-2">About Document Import</h3>
              <p className="text-sm text-foreground/80 mb-3">
                This feature uses AI to extract matter details, transactions, and holds from your documents. 
                Supported formats include:
              </p>
              <ul className="text-sm text-foreground/80 list-disc list-inside space-y-1">
                <li>Matter/transaction history reports (PDF, TXT, DOCX)</li>
                <li>Trust account statements</li>
                <li>Client ledger exports</li>
              </ul>
              <p className="text-sm text-foreground/80 mt-3">
                <strong>Note:</strong> Always review the extracted data before importing. 
                The AI extraction works best with structured documents.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
