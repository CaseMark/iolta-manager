# IOLTA Compliance Reference

State-specific IOLTA (Interest on Lawyer Trust Accounts) rules and compliance requirements.

## What is IOLTA?

IOLTA accounts hold client funds that are:
- Nominal in amount, or
- Held for short periods

Interest earned goes to legal aid and other charitable purposes rather than individual clients.

## Core Compliance Requirements

### Three-Way Reconciliation
Monthly comparison of:
1. **Bank statement** - Actual bank balance
2. **Client ledgers** - Sum of all client matter balances
3. **Trust account register** - Running transaction log

All three must match. Discrepancies require immediate investigation.

### Record Retention
| Requirement | Typical Range |
|-------------|---------------|
| Transaction records | 5-7 years |
| Bank statements | 5-7 years |
| Reconciliation reports | 5-7 years |
| Client ledgers | 5-7 years after matter closes |

### Prohibited Actions
- Commingling (mixing firm and client funds)
- Using one client's funds for another
- Disbursing unearned fees
- Overdrawing client accounts

## State-Specific Rules

### Implementation
```typescript
// lib/iolta-compliance.ts
interface IOLTARules {
  state: string;
  barAssociation: string;
  retentionYears: number;
  reconciliationFrequency: 'monthly' | 'quarterly';
  reportingRequirements: string[];
  specialRules?: string[];
}

export const stateRules: Record<string, IOLTARules> = {
  // See below for state entries
};
```

### Key State Requirements

| State | Retention | Reconciliation | Notes |
|-------|-----------|----------------|-------|
| Alabama | 6 years | Monthly | Alabama State Bar |
| Alaska | 5 years | Monthly | Alaska Bar Association |
| Arizona | 5 years | Monthly | State Bar of Arizona |
| California | 5 years | Monthly | State Bar of California |
| Colorado | 7 years | Monthly | Colorado Bar Association |
| Connecticut | 7 years | Monthly | CT Bar Association |
| Delaware | 5 years | Monthly | Delaware State Bar |
| Florida | 6 years | Monthly | The Florida Bar |
| Georgia | 6 years | Monthly | State Bar of Georgia |
| Hawaii | 6 years | Monthly | Hawaii State Bar |
| Idaho | 5 years | Monthly | Idaho State Bar |
| Illinois | 7 years | Monthly | ISBA |
| Indiana | 5 years | Monthly | Indiana State Bar |
| Iowa | 6 years | Monthly | Iowa State Bar |
| Kansas | 5 years | Monthly | Kansas Bar Association |
| Kentucky | 5 years | Monthly | Kentucky Bar Association |
| Louisiana | 5 years | Monthly | Louisiana State Bar |
| Maine | 6 years | Monthly | Maine State Bar |
| Maryland | 5 years | Monthly | MSBA |
| Massachusetts | 6 years | Monthly | MBA |
| Michigan | 5 years | Monthly | State Bar of Michigan |
| Minnesota | 6 years | Monthly | MSBA |
| Mississippi | 5 years | Monthly | Mississippi Bar |
| Missouri | 5 years | Monthly | Missouri Bar |
| Montana | 5 years | Monthly | State Bar of Montana |
| Nebraska | 5 years | Monthly | NSBA |
| Nevada | 5 years | Monthly | State Bar of Nevada |
| New Hampshire | 6 years | Monthly | NH Bar Association |
| New Jersey | 7 years | Monthly | NJSBA |
| New Mexico | 5 years | Monthly | State Bar of NM |
| New York | 7 years | Monthly | NYSBA |
| North Carolina | 6 years | Monthly | NC State Bar |
| North Dakota | 6 years | Monthly | SBAND |
| Ohio | 6 years | Monthly | Ohio State Bar |
| Oklahoma | 5 years | Monthly | OBA |
| Oregon | 6 years | Monthly | Oregon State Bar |
| Pennsylvania | 5 years | Monthly | PBA |
| Rhode Island | 5 years | Monthly | RI Bar Association |
| South Carolina | 6 years | Monthly | SC Bar |
| South Dakota | 5 years | Monthly | State Bar of SD |
| Tennessee | 5 years | Monthly | TBA |
| Texas | 5 years | Monthly | State Bar of Texas |
| Utah | 5 years | Monthly | Utah State Bar |
| Vermont | 6 years | Monthly | Vermont Bar |
| Virginia | 5 years | Monthly | VSB |
| Washington | 7 years | Monthly | WSBA |
| West Virginia | 5 years | Monthly | WV State Bar |
| Wisconsin | 6 years | Monthly | State Bar of WI |
| Wyoming | 5 years | Monthly | Wyoming State Bar |
| DC | 5 years | Monthly | DC Bar |

## Trust Account Rules

### What Goes In
- Client retainers (before earned)
- Settlement funds
- Escrow deposits
- Funds held for third parties
- Court filing fees (when collected from client)

### What Stays Out
- Earned attorney fees (move to operating)
- Firm expenses
- Personal funds

### Minimum Balance
Some banks require minimum balances. Firms may deposit nominal firm funds to cover:
- Bank fees
- Minimum balance requirements

Document this clearly in records.

## Holds and Available Balance

### Purpose of Holds
- Reserve funds for specific purposes
- Prevent accidental overdisbursement
- Track client-directed restrictions

### Calculation
```typescript
Available Balance = Total Balance - Sum(Active Holds)

// Before any disbursement:
if (disbursementAmount > availableBalance) {
  throw new Error('Insufficient available funds');
}
```

### Hold Best Practices
- Document reason for each hold
- Release holds promptly when resolved
- Include holds in client ledger reports

## Audit Trail Requirements

### What to Log
- All transactions (deposits, disbursements)
- Hold placements and releases
- Report generation
- Settings changes
- User access (when multi-user)

### Log Format
```typescript
{
  timestamp: Date,
  action: 'create' | 'update' | 'delete' | 'view',
  entityType: 'transaction' | 'hold' | 'report' | 'settings',
  entityId: string,
  userId: string,  // When auth enabled
  details: object,  // Context-specific data
  ipAddress: string,
}
```

## Report Requirements

### Monthly Trust Account Report
Required elements:
- Period dates
- Opening balance
- All transactions with dates
- Closing balance
- Matter-by-matter breakdown

### Three-Way Reconciliation
Required elements:
- Bank statement balance
- Outstanding deposits
- Outstanding checks
- Adjusted bank balance
- Client ledger total
- Trust register balance
- Discrepancy explanation (if any)

### Client Ledger
Required elements:
- Client name
- All matters
- Transaction detail with running balance
- Active holds
- Available balance

## Common Violations

| Violation | Risk Level | Prevention |
|-----------|------------|------------|
| Commingling | Severe | Separate accounts, regular audits |
| Negative balance | Severe | Check available balance before disbursement |
| Missing records | High | Automated audit logging |
| Late reconciliation | Medium | Monthly calendar reminders |
| Incomplete ledgers | Medium | Required fields in forms |

## Application Mapping

| Compliance Need | App Feature |
|-----------------|-------------|
| Transaction tracking | Ledger with deposits/disbursements |
| Running balances | Automatic calculation per matter |
| Three-way reconciliation | Reconciliation report |
| Record retention | Database with audit log |
| Hold management | Trust holds feature |
| State rules | Jurisdiction selector in settings |
