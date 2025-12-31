# Reporting Reference

Report generation patterns and templates for IOLTA compliance.

## Report Types

### 1. Monthly Trust Account Report

**Purpose**: Period summary of all trust account activity.

**API Endpoint**: `GET /api/reports/monthly`

**Parameters**:
```typescript
interface MonthlyReportParams {
  startDate: string;  // ISO date
  endDate: string;    // ISO date
  format?: 'html' | 'pdf';
}
```

**Response Structure**:
```typescript
interface MonthlyReport {
  period: { start: string; end: string };
  firmName: string;
  state: string;
  openingBalance: number;
  closingBalance: number;
  totalDeposits: number;
  totalDisbursements: number;
  transactions: TransactionWithMatter[];
  matterSummaries: MatterSummary[];
  complianceNotes: string[];
}
```

**Generation Pattern**:
```typescript
async function generateMonthlyReport(startDate: Date, endDate: Date) {
  // 1. Get opening balance (sum of all txns before startDate)
  const openingBalance = await calculateBalanceAsOf(startDate);
  
  // 2. Get period transactions
  const transactions = await db
    .select()
    .from(transactions)
    .where(
      and(
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .orderBy(asc(transactions.date));
  
  // 3. Calculate totals
  const totalDeposits = sumByType(transactions, 'deposit');
  const totalDisbursements = sumByType(transactions, 'disbursement');
  const closingBalance = openingBalance + totalDeposits - totalDisbursements;
  
  // 4. Group by matter
  const matterSummaries = groupByMatter(transactions);
  
  // 5. Get state compliance notes
  const complianceNotes = getStateRules(firmState).reportingRequirements;
  
  return { /* report data */ };
}
```

### 2. Three-Way Reconciliation Report

**Purpose**: Verify bank balance matches client ledgers and trust register.

**API Endpoint**: `GET /api/reports/reconciliation`

**Parameters**:
```typescript
interface ReconciliationParams {
  asOfDate: string;
  bankStatementBalance: number;
  outstandingDeposits?: number;
  outstandingChecks?: number;
}
```

**Response Structure**:
```typescript
interface ReconciliationReport {
  asOfDate: string;
  bankStatement: {
    endingBalance: number;
    outstandingDeposits: number;
    outstandingChecks: number;
    adjustedBalance: number;
  };
  clientLedgers: {
    totalAllMatters: number;
    matterBalances: { matterId: string; name: string; balance: number }[];
  };
  trustRegister: {
    balance: number;
  };
  reconciled: boolean;
  discrepancy: number;
  notes: string;
}
```

**Generation Pattern**:
```typescript
async function generateReconciliation(
  asOfDate: Date,
  bankBalance: number,
  outstandingDeposits: number,
  outstandingChecks: number
) {
  // 1. Calculate adjusted bank balance
  const adjustedBank = bankBalance + outstandingDeposits - outstandingChecks;
  
  // 2. Sum all matter balances
  const matterBalances = await calculateAllMatterBalances(asOfDate);
  const clientLedgerTotal = matterBalances.reduce((a, b) => a + b.balance, 0);
  
  // 3. Get trust register balance
  const registerBalance = await calculateTrustRegisterBalance(asOfDate);
  
  // 4. Check reconciliation
  const reconciled = 
    adjustedBank === clientLedgerTotal && 
    clientLedgerTotal === registerBalance;
  
  const discrepancy = adjustedBank - clientLedgerTotal;
  
  return { /* report data */ };
}
```

### 3. Client Ledger Report

**Purpose**: Individual client's trust account activity across all matters.

**API Endpoint**: `GET /api/reports/client-ledger`

**Parameters**:
```typescript
interface ClientLedgerParams {
  clientId: string;
  startDate?: string;
  endDate?: string;
}
```

**Response Structure**:
```typescript
interface ClientLedgerReport {
  client: Client;
  matters: {
    matter: Matter;
    transactions: TransactionWithRunningBalance[];
    currentBalance: number;
    activeHolds: Hold[];
    availableBalance: number;
  }[];
  totalBalance: number;
  totalHolds: number;
  totalAvailable: number;
}
```

## Report Components

### HTML Report Template
```typescript
// components/reports/MonthlyReportTemplate.tsx
export function MonthlyReportTemplate({ data }: { data: MonthlyReport }) {
  return (
    <div className="report">
      <header>
        <h1>{data.firmName}</h1>
        <h2>Trust Account Report</h2>
        <p>Period: {data.period.start} to {data.period.end}</p>
      </header>
      
      <section className="summary">
        <dl>
          <dt>Opening Balance</dt>
          <dd>{formatCurrency(data.openingBalance)}</dd>
          <dt>Total Deposits</dt>
          <dd>{formatCurrency(data.totalDeposits)}</dd>
          <dt>Total Disbursements</dt>
          <dd>{formatCurrency(data.totalDisbursements)}</dd>
          <dt>Closing Balance</dt>
          <dd>{formatCurrency(data.closingBalance)}</dd>
        </dl>
      </section>
      
      <section className="transactions">
        <TransactionTable transactions={data.transactions} />
      </section>
      
      <section className="matters">
        {data.matterSummaries.map(m => (
          <MatterSummaryCard key={m.matterId} matter={m} />
        ))}
      </section>
      
      <footer className="compliance">
        <h3>Compliance Notes ({data.state})</h3>
        <ul>
          {data.complianceNotes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
```

### PDF Styling
```typescript
// lib/pdf-styles.ts
export const reportStyles = {
  page: {
    padding: '0.75in',
    fontFamily: 'Helvetica',
    fontSize: '10pt',
  },
  header: {
    borderBottom: '2px solid #333',
    marginBottom: '20px',
    paddingBottom: '10px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    backgroundColor: '#f5f5f5',
    padding: '8px',
    textAlign: 'left',
    borderBottom: '1px solid #ddd',
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #eee',
  },
  currency: {
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  total: {
    fontWeight: 'bold',
    borderTop: '2px solid #333',
  },
};
```

## Utility Functions

### Currency Formatting
```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
```

### Date Formatting
```typescript
export function formatReportDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}
```

### Balance Calculation
```typescript
export function calculateRunningBalance(
  transactions: Transaction[],
  startingBalance: number = 0
): TransactionWithRunningBalance[] {
  let balance = startingBalance;
  
  return transactions.map(t => {
    const amount = parseFloat(t.amount);
    balance += t.type === 'deposit' ? amount : -amount;
    return { ...t, runningBalance: balance };
  });
}
```

## Export Options

### Print-Ready HTML
```typescript
// Use @media print styles
export function PrintableReport({ children }) {
  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
          .page-break { page-break-after: always; }
        }
      `}</style>
      {children}
    </>
  );
}
```

### PDF Generation
```typescript
// Using React PDF or html2pdf
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  const canvas = await html2canvas(element);
  const pdf = new jsPDF('p', 'mm', 'letter');
  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', 10, 10, 190, 0);
  pdf.save(filename);
}
```

## Audit Logging for Reports

```typescript
// Log report generation
await db.insert(auditLog).values({
  action: 'generate',
  entityType: 'report',
  details: {
    reportType: 'monthly',
    period: { start: startDate, end: endDate },
    generatedAt: new Date().toISOString(),
  },
});
```
