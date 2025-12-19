"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { 
  FileText, 
  Download, 
  Calendar, 
  Briefcase, 
  Users, 
  AlertCircle, 
  CheckCircle,
  Settings,
  AlertTriangle,
  Eye,
  X,
  Loader2,
  Printer
} from "lucide-react";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  status: string;
}

interface SettingsData {
  state: string | null;
  firmName: string | null;
}

interface ReportPreviewData {
  type: 'monthly-trust' | 'client-ledger' | 'reconciliation';
  title: string;
  html: string;
}

// Helper function to get date range presets
function getDatePresets() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  const dayOfWeek = today.getDay();

  const lastMonday = new Date(today);
  lastMonday.setDate(currentDay - dayOfWeek - 6);
  
  const firstOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
  const firstOfYear = new Date(currentYear, 0, 1);
  const firstOfCurrentMonth = new Date(currentYear, currentMonth, 1);

  return {
    lastWeek: {
      startDate: lastMonday.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      label: 'Last Week to Date',
    },
    lastMonth: {
      startDate: firstOfLastMonth.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      label: 'Last Month to Date',
    },
    yearToDate: {
      startDate: firstOfYear.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      label: 'Year to Date',
    },
    currentMonth: {
      startDate: firstOfCurrentMonth.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
      label: 'Current Month',
    },
  };
}

export default function ReportsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [bankStatementBalance, setBankStatementBalance] = useState<string>("");
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [showStatePrompt, setShowStatePrompt] = useState(false);
  const [stateInput, setStateInput] = useState("");
  const [savingState, setSavingState] = useState(false);
  const [dateRangeConfirmed, setDateRangeConfirmed] = useState(false);
  
  // Preview modal state
  const [previewData, setPreviewData] = useState<ReportPreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  
  const presets = getDatePresets();
  const [dateRange, setDateRange] = useState({
    startDate: presets.currentMonth.startDate,
    endDate: presets.currentMonth.endDate,
  });
  const [activePreset, setActivePreset] = useState<string>('currentMonth');

  useEffect(() => {
    async function fetchData() {
      try {
        const clientsResponse = await fetch('/api/clients');
        if (clientsResponse.ok) {
          const data = await clientsResponse.json();
          setClients(data.filter((c: Client) => c.status === 'active'));
        }

        const settingsResponse = await fetch('/api/settings');
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          setSettings(settingsData);
          if (!settingsData?.state) {
            setShowStatePrompt(true);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setSettingsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handlePresetSelect = (presetKey: string) => {
    const preset = presets[presetKey as keyof typeof presets];
    if (preset) {
      setDateRange({ startDate: preset.startDate, endDate: preset.endDate });
      setActivePreset(presetKey);
      setDateRangeConfirmed(false);
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange({ ...dateRange, [field]: value });
    setActivePreset('custom');
    setDateRangeConfirmed(false);
  };

  const handleConfirmDateRange = () => {
    setDateRangeConfirmed(true);
  };

  const handleSaveState = async () => {
    if (!stateInput.trim()) return;
    setSavingState(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateInput.trim() }),
      });
      if (response.ok) {
        setSettings({ ...settings, state: stateInput.trim() } as SettingsData);
        setShowStatePrompt(false);
      }
    } catch (error) {
      console.error('Error saving state:', error);
    } finally {
      setSavingState(false);
    }
  };

  // Preview report before download
  const handlePreviewReport = async (reportType: 'monthly-trust' | 'client-ledger' | 'reconciliation') => {
    if (!settings?.state) {
      setShowStatePrompt(true);
      return;
    }

    setLoading(reportType);
    try {
      let response: Response;
      let title: string;

      if (reportType === 'monthly-trust') {
        response = await fetch('/api/reports/monthly-trust', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dateRange),
        });
        title = 'Monthly Trust Account Report';
      } else if (reportType === 'client-ledger') {
        if (!selectedClientId) {
          alert('Please select a client first.');
          setLoading(null);
          return;
        }
        response = await fetch('/api/reports/client-ledger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...dateRange, clientId: selectedClientId }),
        });
        const client = clients.find(c => c.id === selectedClientId);
        title = `Client Ledger - ${client?.name || 'Report'}`;
      } else {
        response = await fetch('/api/reports/reconciliation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asOfDate: dateRange.endDate,
            bankStatementBalance: bankStatementBalance || null,
          }),
        });
        title = 'Reconciliation Report';
      }

      if (!response.ok) throw new Error('Failed to generate report');

      const html = await response.text();
      setPreviewData({ type: reportType, title, html });
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  // Download report as PDF (print to PDF)
  const handleDownloadPDF = () => {
    if (!previewIframeRef.current) return;
    
    const iframe = previewIframeRef.current;
    const iframeWindow = iframe.contentWindow;
    
    if (iframeWindow) {
      iframeWindow.print();
    }
  };

  // Download as HTML
  const handleDownloadHTML = () => {
    if (!previewData) return;
    
    const blob = new Blob([previewData.html], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${previewData.type}-report-${dateRange.startDate}-to-${dateRange.endDate}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const formatDateDisplay = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="p-8">
      {/* State Prompt Modal */}
      {showStatePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-neutral-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-neutral-600" />
              </div>
              <h3 className="text-lg font-semibold">State Required</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              IOLTA compliance requirements vary by state. Please enter your state bar jurisdiction.
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stateInput">State Bar Jurisdiction</Label>
                <Input
                  id="stateInput"
                  value={stateInput}
                  onChange={(e) => setStateInput(e.target.value)}
                  placeholder="e.g., California, New York, Texas"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowStatePrompt(false)}>Cancel</Button>
                <Link href="/settings">
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Go to Settings
                  </Button>
                </Link>
                <Button onClick={handleSaveState} disabled={!stateInput.trim() || savingState}>
                  {savingState ? 'Saving...' : 'Save & Continue'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-[95vw] h-[95vh] max-w-6xl flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">{previewData.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {formatDateDisplay(dateRange.startDate)} — {formatDateDisplay(dateRange.endDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadHTML}>
                  <Download className="h-4 w-4 mr-2" />
                  Download HTML
                </Button>
                <Button size="sm" onClick={handleDownloadPDF}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print / Save as PDF
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Preview Content */}
            <div className="flex-1 overflow-hidden p-4 bg-muted">
              <iframe
                ref={previewIframeRef}
                srcDoc={previewData.html}
                className="w-full h-full bg-white rounded shadow-lg"
                title="Report Preview"
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t bg-muted text-sm text-muted-foreground">
              <p>
                <strong>To save as PDF:</strong> Click &quot;Print / Save as PDF&quot; and select &quot;Save as PDF&quot; as your printer destination.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Generate compliance and trust account reports</p>
        </div>
        {settings?.state && (
          <Badge variant="outline" className="text-sm">
            <Settings className="h-3 w-3 mr-1" />
            {settings.state}
          </Badge>
        )}
      </div>

      {/* State Warning */}
      {!settingsLoading && !settings?.state && (
        <Card className="mb-6 bg-neutral-50 border-neutral-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-neutral-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900">State Not Configured</h3>
                <p className="text-sm text-neutral-600 mt-1">
                  IOLTA compliance requirements vary by state. Please configure your state in settings.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setShowStatePrompt(true)}>
                  Set State Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date Range Selection */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Report Period
          </CardTitle>
          <CardDescription className="text-xs">
            Select date range. Default: Current month.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={activePreset === 'currentMonth' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => handlePresetSelect('currentMonth')}
            >
              Current Month
            </Button>
            <Button
              variant={activePreset === 'lastWeek' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => handlePresetSelect('lastWeek')}
            >
              Last Week
            </Button>
            <Button
              variant={activePreset === 'lastMonth' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => handlePresetSelect('lastMonth')}
            >
              Last Month
            </Button>
            <Button
              variant={activePreset === 'yearToDate' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => handlePresetSelect('yearToDate')}
            >
              YTD
            </Button>
            {activePreset === 'custom' && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5">Custom</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-xs">
            <div className="space-y-1">
              <Label htmlFor="startDate" className="text-xs">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                className="h-8 text-sm"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate" className="text-xs">End Date</Label>
              <Input
                id="endDate"
                type="date"
                className="h-8 text-sm"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleConfirmDateRange}
              disabled={dateRangeConfirmed}
              variant={dateRangeConfirmed ? 'outline' : 'default'}
              size="sm"
              className="h-7 text-xs"
            >
              {dateRangeConfirmed ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1.5 text-primary" />
                  Confirmed
                </>
              ) : (
                'Confirm'
              )}
            </Button>
            {dateRangeConfirmed && (
              <p className="text-xs text-muted-foreground">
                {formatDateDisplay(dateRange.startDate)} — {formatDateDisplay(dateRange.endDate)}
              </p>
            )}
          </div>

          {!dateRangeConfirmed && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Confirm date range before generating reports
            </p>
          )}
        </CardContent>
      </Card>

      {/* Report Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Monthly Trust Account Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Monthly Trust Account Report
            </CardTitle>
            <CardDescription>
              Complete trust account summary with all transactions and matter breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Includes:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Opening and closing balances</li>
                  <li>All deposits and disbursements</li>
                  <li>Matter-by-matter breakdown</li>
                  <li>Active holds and available balance</li>
                </ul>
              </div>
              <Button 
                onClick={() => handlePreviewReport('monthly-trust')}
                disabled={loading !== null || !dateRangeConfirmed}
                className="w-full"
              >
                {loading === 'monthly-trust' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" />Preview Report</>
                )}
              </Button>
              {!dateRangeConfirmed && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />Confirm date range first
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Client Ledger Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-neutral-500" />
              Client Ledger Report
            </CardTitle>
            <CardDescription>
              Individual client trust account activity across all their matters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientSelect">Select Client</Label>
                <Select
                  id="clientSelect"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">-- Select a client --</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </Select>
              </div>
              <Button 
                onClick={() => handlePreviewReport('client-ledger')}
                disabled={loading !== null || !selectedClientId || !dateRangeConfirmed}
                variant="outline"
                className="w-full"
              >
                {loading === 'client-ledger' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" />Preview Report</>
                )}
              </Button>
              {!selectedClientId && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />Select a client
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reconciliation Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-neutral-500" />
              Reconciliation Report
            </CardTitle>
            <CardDescription>
              Three-way reconciliation summary for bar compliance verification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankBalance">Bank Statement Balance (optional)</Label>
                <Input
                  id="bankBalance"
                  type="number"
                  step="0.01"
                  placeholder="Enter bank statement balance"
                  value={bankStatementBalance}
                  onChange={(e) => setBankStatementBalance(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => handlePreviewReport('reconciliation')}
                disabled={loading !== null || !dateRangeConfirmed}
                variant="outline"
                className="w-full"
              >
                {loading === 'reconciliation' ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" />Preview Report</>
                )}
              </Button>
              {!dateRangeConfirmed && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />Confirm date range first
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Notice */}
      <Card className="mt-8 bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <FileText className="h-6 w-6 text-primary flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-primary">Compliance Note</h3>
              <p className="text-sm text-foreground/80 mt-1">
                Reports are generated in a professional black and white format suitable for printing and PDF export.
                Use the &quot;Print / Save as PDF&quot; button in the preview to save reports as PDF files.
              </p>
              <p className="text-sm text-foreground/80 mt-2">
                <strong>Default Date Range:</strong> Current month (from the 1st to today).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
