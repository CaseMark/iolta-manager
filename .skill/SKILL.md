---
name: iolta-manager
description: |
  Development skill for CaseMark's IOLTA Manager application - a trust account 
  management system for law firms to maintain IOLTA compliance. Features client/matter 
  management, transaction tracking, trust holds, compliance reports, and audit trails. 
  Built with Next.js 15, PostgreSQL, Drizzle ORM, and Tailwind CSS. Use this skill when: 
  (1) Working on or extending the iolta-manager codebase, (2) Adding transaction or 
  accounting features, (3) Modifying the database schema, (4) Building compliance reports, 
  (5) Working with state-specific IOLTA rules, or (6) Implementing audit/security features.
---

# IOLTA Manager Development Guide

A trust account management application for law firms to maintain IOLTA (Interest on Lawyer Trust Accounts) compliance—tracking client funds, generating reports, and maintaining proper records per state bar requirements.

**Live site**: https://iolta-manager.casedev.app/

## Architecture

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── audit/              # Audit log endpoints
│   │   ├── clients/            # Client CRUD
│   │   ├── holds/              # Trust holds management
│   │   ├── matters/            # Matter management
│   │   ├── reports/            # Report generation
│   │   ├── settings/           # Firm settings
│   │   └── transactions/       # Transaction operations
│   ├── audit/                  # Audit log page
│   ├── clients/                # Client pages
│   ├── holds/                  # Holds management
│   ├── ledger/                 # Transaction ledger
│   ├── matters/                # Matter pages
│   ├── reports/                # Reports page
│   └── settings/               # Settings page
├── components/
│   ├── holds/                  # Hold-related components
│   ├── layout/                 # Sidebar, navigation
│   ├── matters/                # Matter components
│   ├── reports/                # Report components
│   └── ui/                     # Base UI components
├── db/
│   ├── index.ts                # Database connection
│   └── schema.ts               # Drizzle schema
└── lib/
    ├── audit.ts                # Audit logging utilities
    ├── iolta-compliance.ts     # State-specific rules
    ├── pdf-styles.ts           # Report styling
    └── utils.ts                # General utilities
```

## Core Workflow

```
Create Client → Create Matter → Record Transactions → Place Holds → Generate Reports
      ↓              ↓                  ↓                 ↓               ↓
  Contact info   Link to client    Deposits/         Reserve funds   Monthly,
  stored         assign number     Disbursements     prevent over-   Reconciliation,
                                   track balance     disbursement    Client Ledger
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL + Drizzle ORM |
| Auth | NextAuth.js (demo mode) |
| PDF | React PDF |
| Icons | Lucide React |

## Key Features

| Feature | Description |
|---------|-------------|
| Dashboard | Real-time trust balance, recent transactions, active matters |
| Client Management | Profiles, contact info, matter associations |
| Matter Management | Link to clients, matter numbers, status tracking |
| Transaction Tracking | Deposits, disbursements, running balances |
| Trust Holds | Reserve funds, track reasons, available balance |
| Compliance Reports | Monthly, three-way reconciliation, client ledger |
| Audit Trail | Log all actions for compliance documentation |

## Database Operations

PostgreSQL with Drizzle ORM. See [references/database-schema.md](references/database-schema.md) for complete schema.

### Commands
```bash
npm run db:push      # Push schema (dev)
npm run db:generate  # Generate migrations
npm run db:studio    # Open Drizzle Studio
```

### Core Tables
- **clients**: name, email, phone, address
- **matters**: clientId, name, matterNumber, status
- **transactions**: matterId, type, amount, date, payor/payee
- **holds**: matterId, amount, reason, status
- **trustAccountSettings**: firmName, state, bankInfo
- **auditLog**: action, entityType, entityId, details, timestamp

## Development

### Setup
```bash
npm install
cp .env.example .env.local
# Add DATABASE_URL to .env.local
npm run db:push
npm run dev
```

### Environment
```
DATABASE_URL=postgresql://...    # PostgreSQL connection
NEXTAUTH_SECRET=...              # Auth secret (required for prod)
NEXTAUTH_URL=http://localhost:3000
```

## IOLTA Compliance

See [references/iolta-compliance.md](references/iolta-compliance.md) for state-specific rules.

### Supported Jurisdictions
All 50 states + DC with specific rules for record retention (5-7 years) and reconciliation requirements (monthly).

### Key Compliance Concepts
- **Three-way reconciliation**: Bank statement + client ledgers + trust register
- **Trust holds**: Prevent disbursement of reserved funds
- **Audit trail**: Document all actions for bar compliance

## Report Types

See [references/reporting.md](references/reporting.md) for generation patterns.

| Report | Purpose |
|--------|---------|
| Monthly Trust Account | Period transactions, opening/closing balances |
| Three-Way Reconciliation | Bank vs ledger vs register comparison |
| Client Ledger | Per-client fund tracking, all matters |

## Common Tasks

### Adding a New Report Type
1. Create report component in `components/reports/`
2. Add API endpoint in `app/api/reports/`
3. Add to report selector in `app/reports/page.tsx`
4. Style with `lib/pdf-styles.ts`

### Adding a New Transaction Type
1. Update transaction type enum in `db/schema.ts`
2. Modify transaction form component
3. Update balance calculations in API routes
4. Add to audit logging

### State Compliance Rules
```typescript
// lib/iolta-compliance.ts
export function getStateRules(state: string): IOLTARules {
  // Returns retention period, reconciliation frequency, bar association
}
```

## Security Considerations

- Bank account numbers masked (last 4 digits only)
- Show/hide toggle for sensitive data
- Audit trail for all actions
- Role-based access (when auth enabled)

## Demo vs Production

Currently ships in demo mode. For production:
- Implement proper NextAuth.js authentication
- Add user roles (admin, attorney, paralegal, readonly)
- Enable RBAC for transactions/reports
- Configure proper NEXTAUTH_SECRET

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Balance mismatch | Check transaction types, verify holds |
| Report generation fails | Verify date range, check matter exists |
| Hold amount exceeds balance | Cannot hold more than available funds |
| Audit log missing entries | Check audit.ts is called in API routes |
