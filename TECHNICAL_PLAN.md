# IOLTA Trust Account Manager - Technical Plan

## Overview

A trust accounting dashboard for law firms that tracks client funds, manages holds, and generates compliance reports. Built on Next.js with DrizzleORM/SQLite for local data management and Case.dev Payments API for trust accounting operations.

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │Dashboard │ │ Matters  │ │ Ledger   │ │ Reports          │   │
│  │Overview  │ │ Manager  │ │ View     │ │ Generator        │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js API Routes)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │/api/     │ │/api/     │ │/api/     │ │/api/             │   │
│  │clients   │ │matters   │ │ledger    │ │reports           │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│   Local SQLite DB       │     │      Case.dev Payments API      │
│   (DrizzleORM)          │     │                                 │
│  ┌───────────────────┐  │     │  • Trust Accounts               │
│  │ clients           │  │     │  • Sub-Accounts (per matter)    │
│  │ matters           │  │     │  • Charges (deposits)           │
│  │ audit_logs        │  │     │  • Transfers (disbursements)    │
│  │ report_history    │  │     │  • Holds                        │
│  └───────────────────┘  │     │  • Ledger Entries               │
└─────────────────────────┘     └─────────────────────────────────┘
```

### Data Flow Strategy

**Local SQLite Database (DrizzleORM):**
- Client information (name, contact, metadata)
- Matter details (case name, status, dates)
- Audit logs for local operations
- Report generation history
- User preferences and settings

**Case.dev Payments API:**
- Trust account management
- Sub-accounts per client/matter
- All financial transactions (deposits, disbursements)
- Holds management (earned vs. unearned)
- Ledger entries and balances
- Compliance-ready audit trail

---

## Database Schema (DrizzleORM/SQLite)

### Schema Definition

```typescript
// src/db/schema.ts

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Clients table - stores client information
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  status: text('status').default('active'), // active, inactive, archived
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Matters table - stores case/matter information
export const matters = sqliteTable('matters', {
  id: text('id').primaryKey(), // UUID
  clientId: text('client_id').notNull().references(() => clients.id),
  name: text('name').notNull(), // e.g., "Smith v. Jones"
  matterNumber: text('matter_number').unique(), // Internal reference number
  description: text('description'),
  status: text('status').default('open'), // open, closed, pending
  practiceArea: text('practice_area'), // litigation, corporate, family, etc.
  responsibleAttorney: text('responsible_attorney'),
  openDate: integer('open_date', { mode: 'timestamp' }).notNull(),
  closeDate: integer('close_date', { mode: 'timestamp' }),
  // Case.dev integration
  casedevAccountId: text('casedev_account_id'), // Sub-account ID from Case.dev
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Transactions table - local cache/reference of Case.dev transactions
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(), // UUID
  matterId: text('matter_id').notNull().references(() => matters.id),
  casedevTransactionId: text('casedev_transaction_id'), // Reference to Case.dev
  type: text('type').notNull(), // deposit, disbursement, transfer, hold
  amount: integer('amount').notNull(), // Amount in cents
  description: text('description').notNull(),
  payee: text('payee'), // For disbursements
  payor: text('payor'), // For deposits
  checkNumber: text('check_number'),
  reference: text('reference'), // Invoice number, etc.
  status: text('status').default('completed'), // pending, completed, cancelled
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  createdBy: text('created_by'),
});

// Holds table - local reference of holds on accounts
export const holds = sqliteTable('holds', {
  id: text('id').primaryKey(), // UUID
  matterId: text('matter_id').notNull().references(() => matters.id),
  casedevHoldId: text('casedev_hold_id'), // Reference to Case.dev
  amount: integer('amount').notNull(), // Amount in cents
  type: text('type').notNull(), // retainer, settlement, escrow, compliance
  description: text('description').notNull(),
  status: text('status').default('active'), // active, released, cancelled
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  releasedAt: integer('released_at', { mode: 'timestamp' }),
  releasedBy: text('released_by'),
  releaseReason: text('release_reason'),
});

// Audit logs table - comprehensive audit trail
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(), // UUID
  entityType: text('entity_type').notNull(), // client, matter, transaction, hold, report
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // create, update, delete, view, export
  details: text('details'), // JSON string with change details
  userId: text('user_id'),
  userEmail: text('user_email'),
  ipAddress: text('ip_address'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// Report history table - tracks generated reports
export const reportHistory = sqliteTable('report_history', {
  id: text('id').primaryKey(), // UUID
  reportType: text('report_type').notNull(), // monthly_trust, client_ledger, reconciliation
  reportName: text('report_name').notNull(),
  parameters: text('parameters'), // JSON string with report parameters
  generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
  generatedBy: text('generated_by'),
  filePath: text('file_path'), // Path to generated PDF
  status: text('status').default('completed'), // pending, completed, failed
});

// Trust account settings
export const trustAccountSettings = sqliteTable('trust_account_settings', {
  id: text('id').primaryKey(),
  bankName: text('bank_name'),
  accountNumber: text('account_number'),
  routingNumber: text('routing_number'),
  casedevTrustAccountId: text('casedev_trust_account_id'), // Main trust account in Case.dev
  casedevOperatingAccountId: text('casedev_operating_account_id'),
  state: text('state'), // For state-specific compliance rules
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

### Database Migrations

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './data/iolta.db',
  },
} satisfies Config;
```

---

## API Routes Structure

### Client Management

```
POST   /api/clients              - Create new client
GET    /api/clients              - List all clients
GET    /api/clients/[id]         - Get client details
PUT    /api/clients/[id]         - Update client
DELETE /api/clients/[id]         - Archive client (soft delete)
GET    /api/clients/[id]/matters - Get client's matters
```

### Matter Management

```
POST   /api/matters              - Create new matter (+ Case.dev sub-account)
GET    /api/matters              - List all matters
GET    /api/matters/[id]         - Get matter details with balance
PUT    /api/matters/[id]         - Update matter
DELETE /api/matters/[id]         - Close matter
GET    /api/matters/[id]/ledger  - Get matter ledger from Case.dev
GET    /api/matters/[id]/balance - Get current balance
```

### Transaction Management

```
POST   /api/transactions/deposit      - Record deposit (Case.dev charge)
POST   /api/transactions/disbursement - Record disbursement (Case.dev transfer)
GET    /api/transactions              - List transactions (with filters)
GET    /api/transactions/[id]         - Get transaction details
```

### Hold Management

```
POST   /api/holds                - Create hold on matter funds
GET    /api/holds                - List all active holds
GET    /api/holds/[id]           - Get hold details
POST   /api/holds/[id]/release   - Release hold
POST   /api/holds/[id]/approve   - Approve hold release
```

### Ledger & Reconciliation

```
GET    /api/ledger               - Get full trust account ledger
GET    /api/ledger/summary       - Get account summary with totals
GET    /api/reconciliation       - Get three-way reconciliation data
POST   /api/reconciliation/verify - Verify reconciliation
```

### Reports

```
POST   /api/reports/monthly-trust     - Generate monthly trust report PDF
POST   /api/reports/client-ledger     - Generate client ledger report PDF
POST   /api/reports/reconciliation    - Generate reconciliation report PDF
GET    /api/reports/history           - Get report generation history
GET    /api/reports/download/[id]     - Download generated report
```

### Audit

```
GET    /api/audit                - Get audit logs (with filters)
GET    /api/audit/export         - Export audit logs
```

---

## Case.dev API Integration

### Service Layer

```typescript
// src/lib/casedev/payments.ts

const CASEDEV_API_BASE = 'https://api.case.dev/payments/v1';

interface CaseDevConfig {
  apiKey: string;
}

export class CaseDevPaymentsService {
  private apiKey: string;

  constructor(config: CaseDevConfig) {
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${CASEDEV_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Case.dev API error: ${response.statusText}`);
    }

    return response.json();
  }

  // Account Operations
  async createSubAccount(params: {
    name: string;
    parentAccountId: string;
    metadata: { clientId: string; matterId: string };
  }) {
    return this.request('/accounts', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        type: 'sub_account',
        parent_account_id: params.parentAccountId,
        currency: 'USD',
        metadata: params.metadata,
      }),
    });
  }

  async getAccountBalance(accountId: string) {
    return this.request(`/accounts/${accountId}/balance`);
  }

  async getAccountLedger(accountId: string, params?: {
    startDate?: string;
    endDate?: string;
  }) {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.request(`/accounts/${accountId}/ledger?${query}`);
  }

  // Charge Operations (Deposits)
  async createCharge(params: {
    accountId: string;
    amount: number; // in cents
    description: string;
    partyId?: string;
  }) {
    return this.request('/charges', {
      method: 'POST',
      body: JSON.stringify({
        account_id: params.accountId,
        amount: params.amount,
        currency: 'USD',
        description: params.description,
        party_id: params.partyId,
      }),
    });
  }

  // Transfer Operations (Disbursements)
  async createTransfer(params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description: string;
    requiresApproval?: boolean;
  }) {
    return this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        from_account_id: params.fromAccountId,
        to_account_id: params.toAccountId,
        amount: params.amount,
        description: params.description,
        requires_approval: params.requiresApproval ?? true,
      }),
    });
  }

  async approveTransfer(transferId: string) {
    return this.request(`/transfers/${transferId}/approve`, {
      method: 'POST',
    });
  }

  // Hold Operations
  async createHold(params: {
    accountId: string;
    amount: number;
    type: 'retainer' | 'settlement' | 'escrow' | 'compliance';
    description: string;
    requiredApprovers?: string[];
  }) {
    return this.request('/holds', {
      method: 'POST',
      body: JSON.stringify({
        account_id: params.accountId,
        amount: params.amount,
        type: params.type,
        description: params.description,
        required_approvers: params.requiredApprovers,
      }),
    });
  }

  async releaseHold(holdId: string, reason: string) {
    return this.request(`/holds/${holdId}/release`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async approveHold(holdId: string, approverId: string) {
    return this.request(`/holds/${holdId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approver_id: approverId }),
    });
  }

  // Ledger Operations
  async getLedgerTransaction(transactionId: string) {
    return this.request(`/ledger/transactions/${transactionId}`);
  }

  async queryLedger(params: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.request(`/ledger?${query}`);
  }

  // Trust Account Summary
  async getTrustAccountSummary(parentAccountId: string) {
    return this.request(`/accounts?type=sub_account&parent_account_id=${parentAccountId}`);
  }
}
```

---

## UI Components & Pages

### Page Structure

```
src/app/
├── layout.tsx                    # Root layout with sidebar navigation
├── page.tsx                      # Dashboard overview
├── clients/
│   ├── page.tsx                  # Client list
│   ├── new/page.tsx              # Create client form
│   └── [id]/
│       ├── page.tsx              # Client details
│       └── edit/page.tsx         # Edit client
├── matters/
│   ├── page.tsx                  # Matter list
│   ├── new/page.tsx              # Create matter form
│   └── [id]/
│       ├── page.tsx              # Matter details with ledger
│       ├── deposit/page.tsx      # Record deposit
│       ├── disburse/page.tsx     # Record disbursement
│       └── hold/page.tsx         # Manage holds
├── ledger/
│   ├── page.tsx                  # Full trust account ledger
│   └── reconciliation/page.tsx   # Three-way reconciliation
├── reports/
│   ├── page.tsx                  # Report generator
│   └── history/page.tsx          # Report history
└── settings/
    └── page.tsx                  # Trust account settings
```

### Key UI Components

```typescript
// Component hierarchy

// Layout Components
├── Sidebar                       # Navigation sidebar
├── Header                        # Page header with breadcrumbs
└── PageContainer                 # Consistent page wrapper

// Dashboard Components
├── TrustAccountSummaryCard       # Total balance, available, held
├── RecentTransactionsTable       # Last 10 transactions
├── MatterBalancesList            # Quick view of matter balances
└── AlertsPanel                   # Pending approvals, low balances

// Client/Matter Components
├── ClientForm                    # Create/edit client
├── MatterForm                    # Create/edit matter
├── ClientCard                    # Client summary card
└── MatterCard                    # Matter summary with balance

// Ledger Components
├── LedgerTable                   # Accounting-style transaction table
│   ├── LedgerRow                 # Individual transaction row
│   ├── LedgerFilters             # Date range, type, matter filters
│   └── LedgerSummary             # Running balance, totals
├── TransactionForm               # Deposit/disbursement form
├── HoldManager                   # Create/release holds
└── BalanceDisplay                # Balance with available/held breakdown

// Report Components
├── ReportGenerator               # Report type selection and parameters
├── ReportPreview                 # Preview before PDF generation
├── ReportHistoryTable            # Past generated reports
└── PDFViewer                     # In-app PDF preview

// Reconciliation Components
├── ThreeWayReconciliation        # Bank vs Trust vs Client comparison
├── ReconciliationForm            # Enter bank statement balance
└── DiscrepancyAlert              # Highlight mismatches
```

### Accounting-Style Table Design

```typescript
// src/components/ledger/LedgerTable.tsx

interface LedgerEntry {
  id: string;
  date: Date;
  description: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  matter: string;
  type: 'deposit' | 'disbursement' | 'transfer' | 'hold';
}

// Table columns:
// | Date | Description | Reference | Matter | Debit | Credit | Balance |
// Styled with:
// - Alternating row colors
// - Right-aligned numbers
// - Monospace font for amounts
// - Color coding: green for credits, red for debits
// - Running balance column
// - Sticky header
// - Sortable columns
```

---

## PDF Report Generation

### Technology Choice: `@react-pdf/renderer`

```typescript
// src/lib/reports/monthly-trust-report.tsx

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '1px solid #000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 10,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1px solid #eee',
    fontSize: 10,
  },
  // ... more styles
});

interface MonthlyTrustReportProps {
  firmName: string;
  reportPeriod: { start: Date; end: Date };
  openingBalance: number;
  closingBalance: number;
  transactions: LedgerEntry[];
  matterSummaries: MatterSummary[];
}

export const MonthlyTrustReport = (props: MonthlyTrustReportProps) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>IOLTA Trust Account Report</Text>
        <Text style={styles.subtitle}>{props.firmName}</Text>
        <Text style={styles.subtitle}>
          Period: {formatDate(props.reportPeriod.start)} - {formatDate(props.reportPeriod.end)}
        </Text>
      </View>

      {/* Summary Section */}
      <View style={styles.summary}>
        <Text>Opening Balance: {formatCurrency(props.openingBalance)}</Text>
        <Text>Total Deposits: {formatCurrency(totalDeposits)}</Text>
        <Text>Total Disbursements: {formatCurrency(totalDisbursements)}</Text>
        <Text>Closing Balance: {formatCurrency(props.closingBalance)}</Text>
      </View>

      {/* Transaction Detail */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={{ width: '15%' }}>Date</Text>
          <Text style={{ width: '35%' }}>Description</Text>
          <Text style={{ width: '15%' }}>Matter</Text>
          <Text style={{ width: '12%', textAlign: 'right' }}>Debit</Text>
          <Text style={{ width: '12%', textAlign: 'right' }}>Credit</Text>
          <Text style={{ width: '11%', textAlign: 'right' }}>Balance</Text>
        </View>
        {props.transactions.map((txn) => (
          <View key={txn.id} style={styles.tableRow}>
            <Text style={{ width: '15%' }}>{formatDate(txn.date)}</Text>
            <Text style={{ width: '35%' }}>{txn.description}</Text>
            <Text style={{ width: '15%' }}>{txn.matter}</Text>
            <Text style={{ width: '12%', textAlign: 'right' }}>
              {txn.debit ? formatCurrency(txn.debit) : ''}
            </Text>
            <Text style={{ width: '12%', textAlign: 'right' }}>
              {txn.credit ? formatCurrency(txn.credit) : ''}
            </Text>
            <Text style={{ width: '11%', textAlign: 'right' }}>
              {formatCurrency(txn.balance)}
            </Text>
          </View>
        ))}
      </View>

      {/* Matter Summary */}
      <View style={styles.matterSummary}>
        <Text style={styles.sectionTitle}>Client/Matter Balances</Text>
        {props.matterSummaries.map((matter) => (
          <View key={matter.id} style={styles.matterRow}>
            <Text>{matter.name}</Text>
            <Text>{formatCurrency(matter.balance)}</Text>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>Generated: {formatDateTime(new Date())}</Text>
        <Text>This report is for internal use and bar compliance purposes.</Text>
      </View>
    </Page>
  </Document>
);
```

### Report Types

1. **Monthly Trust Account Report**
   - Opening/closing balances
   - All transactions for the period
   - Matter-by-matter breakdown
   - Compliance certification section

2. **Client Ledger Report**
   - All transactions for a specific client
   - Across all matters
   - Running balance per matter

3. **Three-Way Reconciliation Report**
   - Bank statement balance
   - Trust ledger total
   - Sum of client ledgers
   - Discrepancy identification

4. **Transaction Detail Report**
   - Detailed view of specific transactions
   - Supporting documentation references
   - Approval history

---

## Demo Flow Implementation

### Step 1: Create New Matter "Smith v. Jones"

```typescript
// 1. User navigates to /matters/new
// 2. Fills out form:
//    - Client: Select or create "John Smith"
//    - Matter Name: "Smith v. Jones"
//    - Practice Area: "Litigation"
//    - Responsible Attorney: "Jane Doe"

// API call sequence:
// POST /api/clients (if new client)
// POST /api/matters
//   → Creates local matter record
//   → Calls Case.dev to create sub-account
//   → Links casedevAccountId to matter
```

### Step 2: Deposit $10,000 Retainer

```typescript
// 1. User navigates to /matters/[id]/deposit
// 2. Fills out deposit form:
//    - Amount: $10,000.00
//    - Description: "Initial retainer"
//    - Payor: "John Smith"
//    - Check Number: "1234"

// API call sequence:
// POST /api/transactions/deposit
//   → Calls Case.dev POST /payments/v1/charges
//   → Creates local transaction record
//   → Logs audit entry
```

### Step 3: Show Ledger with Transaction History

```typescript
// 1. User views /matters/[id] or /ledger
// 2. System fetches:
//    - Matter details from local DB
//    - Ledger entries from Case.dev API
//    - Current balance from Case.dev API

// Display:
// | Date       | Description      | Ref  | Debit | Credit    | Balance   |
// |------------|------------------|------|-------|-----------|-----------|
// | 12/15/2024 | Initial retainer | 1234 |       | $10,000.00| $10,000.00|
```

### Step 4: Generate Monthly Trust Account Report PDF

```typescript
// 1. User navigates to /reports
// 2. Selects "Monthly Trust Account Report"
// 3. Sets date range (current month)
// 4. Clicks "Generate Report"

// API call sequence:
// POST /api/reports/monthly-trust
//   → Fetches all transactions from Case.dev
//   → Fetches all matter balances
//   → Generates PDF using @react-pdf/renderer
//   → Saves to file system
//   → Creates report history record
//   → Returns PDF for download/preview
```

---

## Project Structure

```
IOLTAAcctMan/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard
│   │   ├── clients/
│   │   ├── matters/
│   │   ├── ledger/
│   │   ├── reports/
│   │   └── api/                  # API routes
│   │       ├── clients/
│   │       ├── matters/
│   │       ├── transactions/
│   │       ├── holds/
│   │       ├── ledger/
│   │       └── reports/
│   ├── components/               # React components
│   │   ├── ui/                   # Base UI components (shadcn/ui)
│   │   ├── layout/               # Layout components
│   │   ├── clients/              # Client-related components
│   │   ├── matters/              # Matter-related components
│   │   ├── ledger/               # Ledger/transaction components
│   │   └── reports/              # Report components
│   ├── lib/                      # Utilities and services
│   │   ├── casedev/              # Case.dev API client
│   │   ├── reports/              # PDF report generators
│   │   ├── utils/                # Helper functions
│   │   └── validations/          # Zod schemas
│   ├── db/                       # Database
│   │   ├── schema.ts             # Drizzle schema
│   │   ├── index.ts              # DB connection
│   │   └── queries/              # Query helpers
│   └── types/                    # TypeScript types
├── drizzle/                      # Migrations
├── data/                         # SQLite database file
├── public/                       # Static assets
├── package.json
├── drizzle.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "drizzle-orm": "^0.29.0",
    "better-sqlite3": "^9.0.0",
    "@react-pdf/renderer": "^3.1.0",
    "@tanstack/react-table": "^8.10.0",
    "date-fns": "^2.30.0",
    "zod": "^3.22.0",
    "lucide-react": "^0.294.0",
    "tailwindcss": "^3.3.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "drizzle-kit": "^0.20.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0"
  }
}
```

---

## MVP Implementation Checklist

### Phase 1: Project Setup
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up DrizzleORM with SQLite
- [ ] Create database schema and run migrations
- [ ] Set up shadcn/ui components
- [ ] Configure environment variables for Case.dev API

### Phase 2: Core Data Layer
- [ ] Implement Case.dev Payments API client
- [ ] Create database query helpers
- [ ] Set up audit logging utility
- [ ] Implement data validation schemas (Zod)

### Phase 3: Client & Matter Management
- [ ] Client CRUD API routes
- [ ] Matter CRUD API routes (with Case.dev sub-account creation)
- [ ] Client list and detail pages
- [ ] Matter list and detail pages
- [ ] Create client/matter forms

### Phase 4: Transaction Management
- [ ] Deposit API route (Case.dev charges)
- [ ] Disbursement API route (Case.dev transfers)
- [ ] Transaction list with filters
- [ ] Deposit form component
- [ ] Disbursement form component

### Phase 5: Ledger & Balance Display
- [ ] Ledger API route (fetch from Case.dev)
- [ ] Accounting-style ledger table component
- [ ] Balance display component
- [ ] Matter detail page with ledger view
- [ ] Full trust account ledger page

### Phase 6: Hold Management
- [ ] Hold CRUD API routes
- [ ] Hold creation form
- [ ] Hold release workflow
- [ ] Available balance calculation display

### Phase 7: Reports
- [ ] Monthly trust report PDF template
- [ ] Report generation API route
- [ ] Report generator UI
- [ ] Report history tracking
- [ ] PDF download functionality

### Phase 8: Dashboard & Polish
- [ ] Dashboard overview page
- [ ] Summary cards and widgets
- [ ] Navigation and layout
- [ ] Error handling and loading states
- [ ] Responsive design adjustments

---

## Security Considerations

1. **API Key Management**
   - Store Case.dev API key in environment variables
   - Never expose API key to client-side code
   - Use server-side API routes for all Case.dev calls

2. **Data Validation**
   - Validate all inputs with Zod schemas
   - Sanitize user inputs before database operations
   - Validate amounts are positive integers (cents)

3. **Audit Trail**
   - Log all financial operations
   - Include user context in audit logs
   - Immutable audit log entries

4. **Access Control** (Future)
   - Role-based access for approvals
   - Multi-user support with authentication
   - Approval workflows for disbursements

---

## Future Enhancements

1. **Bank Feed Integration**
   - Plaid integration for automatic bank transaction import
   - Automatic matching of bank transactions to ledger entries

2. **Automated Reconciliation**
   - Daily automatic reconciliation checks
   - Alert system for discrepancies

3. **Multi-State Compliance**
   - State-specific trust accounting rules
   - Jurisdiction-aware report generation

4. **Advanced Reporting**
   - Custom report builder
   - Scheduled report generation
   - Email delivery of reports

5. **Workflow Automation**
   - Case.dev Workflows integration
   - Automatic compliance checks
   - Approval routing based on amount thresholds
