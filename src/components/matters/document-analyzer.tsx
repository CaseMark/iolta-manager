'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Upload, 
  FileText, 
  Loader2, 
  Check, 
  X, 
  AlertCircle,
  Sparkles,
  DollarSign,
  Lock
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

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
  selected: boolean;
}

interface ExtractedHold {
  type: string;
  amount: number;
  description: string;
  status: 'active' | 'released';
  createdDate?: string;
  notes?: string;
  selected: boolean;
}

interface AnalysisResult {
  transactions: ExtractedTransaction[];
  holds: ExtractedHold[];
  summary?: {
    documentType?: string;
    dateRange?: string;
    totalDeposits?: number;
    totalDisbursements?: number;
    notes?: string;
  };
}

interface DocumentAnalyzerProps {
  matterId: string;
  matterStatus: string;
  onImportComplete?: () => void;
}

export function DocumentAnalyzer({ matterId, matterStatus, onImportComplete }: DocumentAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [sourceFile, setSourceFile] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{ transactions: number; holds: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setAnalysisResult(null);
    setImportSuccess(null);
    setIsAnalyzing(true);
    setSourceFile(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/matters/${matterId}/analyze`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze document');
      }

      // Add selected flag to all items (default true)
      const result: AnalysisResult = {
        transactions: (data.data.transactions || []).map((t: ExtractedTransaction) => ({ ...t, selected: true })),
        holds: (data.data.holds || []).map((h: ExtractedHold) => ({ ...h, selected: true })),
        summary: data.data.summary,
      };

      setAnalysisResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze document');
    } finally {
      setIsAnalyzing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleTransaction = (index: number) => {
    if (!analysisResult) return;
    const updated = { ...analysisResult };
    updated.transactions[index].selected = !updated.transactions[index].selected;
    setAnalysisResult(updated);
  };

  const toggleHold = (index: number) => {
    if (!analysisResult) return;
    const updated = { ...analysisResult };
    updated.holds[index].selected = !updated.holds[index].selected;
    setAnalysisResult(updated);
  };

  const selectAllTransactions = (selected: boolean) => {
    if (!analysisResult) return;
    const updated = { ...analysisResult };
    updated.transactions = updated.transactions.map(t => ({ ...t, selected }));
    setAnalysisResult(updated);
  };

  const selectAllHolds = (selected: boolean) => {
    if (!analysisResult) return;
    const updated = { ...analysisResult };
    updated.holds = updated.holds.map(h => ({ ...h, selected }));
    setAnalysisResult(updated);
  };

  const handleImport = async () => {
    if (!analysisResult) return;

    const selectedTransactions = analysisResult.transactions.filter(t => t.selected);
    const selectedHolds = analysisResult.holds.filter(h => h.selected);

    if (selectedTransactions.length === 0 && selectedHolds.length === 0) {
      setError('Please select at least one transaction or hold to import');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const response = await fetch(`/api/matters/${matterId}/analyze/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: selectedTransactions,
          holds: selectedHolds,
          sourceFile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import data');
      }

      setImportSuccess({
        transactions: data.imported.transactions,
        holds: data.imported.holds,
      });
      setAnalysisResult(null);

      // Notify parent to refresh
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setSourceFile(null);
    setError(null);
    setImportSuccess(null);
  };

  if (matterStatus === 'closed') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Document Analysis
          </CardTitle>
          <CardDescription>
            Cannot analyze documents for a closed matter
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Document Analysis
        </CardTitle>
        <CardDescription>
          Upload a document to extract transactions and holds using AI
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Success Message */}
        {importSuccess && (
          <div className="mb-4 p-4 bg-neutral-100 border border-neutral-200 rounded-lg">
            <div className="flex items-center gap-2 text-foreground">
              <Check className="h-5 w-5" />
              <span className="font-medium">Import Successful!</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Imported {importSuccess.transactions} transaction(s) and {importSuccess.holds} hold(s).
              Refresh the page to see the updated ledger.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={handleReset}>
              Analyze Another Document
            </Button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-neutral-100 border border-neutral-200 rounded-lg">
            <div className="flex items-center gap-2 text-foreground">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        )}

        {/* File Upload */}
        {!analysisResult && !importSuccess && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.docx,.doc"
                onChange={handleFileSelect}
                className="hidden"
                id="document-upload"
                disabled={isAnalyzing}
              />
              <label htmlFor="document-upload" className="cursor-pointer">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    <p className="text-lg font-medium text-foreground">Analyzing document...</p>
                    <p className="text-sm text-muted-foreground">This may take a moment</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <p className="text-lg font-medium text-foreground">
                      Drop a document here or click to upload
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports PDF, TXT, DOCX files
                    </p>
                  </div>
                )}
              </label>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              AI will extract transactions and holds from invoices, statements, ledgers, and other legal documents
            </p>
          </div>
        )}

        {/* Analysis Results */}
        {analysisResult && (
          <div className="space-y-6">
            {/* Source File */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Analyzed: {sourceFile}</span>
            </div>

            {/* Summary */}
            {analysisResult.summary && (
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Document Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {analysisResult.summary.documentType && (
                    <div>
                      <span className="text-muted-foreground">Type:</span>{' '}
                      <span className="font-medium">{analysisResult.summary.documentType}</span>
                    </div>
                  )}
                  {analysisResult.summary.dateRange && (
                    <div>
                      <span className="text-muted-foreground">Date Range:</span>{' '}
                      <span className="font-medium">{analysisResult.summary.dateRange}</span>
                    </div>
                  )}
                  {analysisResult.summary.totalDeposits !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Total Deposits:</span>{' '}
                      <span className="font-medium">
                        {formatCurrency(analysisResult.summary.totalDeposits * 100)}
                      </span>
                    </div>
                  )}
                  {analysisResult.summary.totalDisbursements !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Total Disbursements:</span>{' '}
                      <span className="font-medium text-muted-foreground">
                        {formatCurrency(analysisResult.summary.totalDisbursements * 100)}
                      </span>
                    </div>
                  )}
                </div>
                {analysisResult.summary.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{analysisResult.summary.notes}</p>
                )}
              </div>
            )}

            {/* Transactions */}
            {analysisResult.transactions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Transactions ({analysisResult.transactions.filter(t => t.selected).length}/{analysisResult.transactions.length} selected)
                  </h4>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => selectAllTransactions(true)}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => selectAllTransactions(false)}>
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.transactions.map((txn, index) => (
                        <TableRow 
                          key={index} 
                          className={`cursor-pointer ${!txn.selected ? 'opacity-50' : ''}`}
                          onClick={() => toggleTransaction(index)}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={txn.selected}
                              onChange={() => toggleTransaction(index)}
                              className="h-4 w-4"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(new Date(txn.date))}
                          </TableCell>
                          <TableCell>
                            <Badge variant={txn.type === 'deposit' ? 'default' : 'secondary'}>
                              {txn.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{txn.description}</p>
                              {txn.payor && <p className="text-xs text-muted-foreground">From: {txn.payor}</p>}
                              {txn.payee && <p className="text-xs text-muted-foreground">To: {txn.payee}</p>}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-mono ${txn.type === 'disbursement' ? 'text-muted-foreground' : ''}`}>
                            {txn.type === 'deposit' ? '+' : '-'}{formatCurrency(txn.amount * 100)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Holds */}
            {analysisResult.holds.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Holds ({analysisResult.holds.filter(h => h.selected).length}/{analysisResult.holds.length} selected)
                  </h4>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => selectAllHolds(true)}>
                      Select All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => selectAllHolds(false)}>
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.holds.map((hold, index) => (
                        <TableRow 
                          key={index} 
                          className={`cursor-pointer ${!hold.selected ? 'opacity-50' : ''}`}
                          onClick={() => toggleHold(index)}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={hold.selected}
                              onChange={() => toggleHold(index)}
                              className="h-4 w-4"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{hold.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{hold.description}</p>
                              {hold.notes && <p className="text-xs text-muted-foreground">{hold.notes}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={hold.status === 'active' ? 'warning' : 'secondary'}>
                              {hold.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(hold.amount * 100)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* No Results */}
            {analysisResult.transactions.length === 0 && analysisResult.holds.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No transactions or holds found in this document.</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleReset}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isImporting || (analysisResult.transactions.filter(t => t.selected).length === 0 && analysisResult.holds.filter(h => h.selected).length === 0)}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Import Selected
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
