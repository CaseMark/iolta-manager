# IOLTA Account Manager

A comprehensive trust account management application for law firms to maintain IOLTA (Interest on Lawyer Trust Accounts) compliance. Built with Next.js, this application helps attorneys track client funds, generate compliance reports, and maintain proper records in accordance with state bar requirements.

## Features

### 📊 Dashboard
- Real-time overview of trust account balance
- Recent transactions summary
- Active matters at a glance
- Quick access to key metrics

### 👥 Client Management
- Create and manage client profiles
- Track contact information (email, phone, address)
- View all matters associated with each client
- Client-specific ledger reports

### 📁 Matter Management
- Create matters linked to clients
- Assign matter numbers for easy reference
- Track matter status (open/closed)
- View transaction history per matter
- Calculate running balances

### 💰 Transaction Tracking
- Record deposits and disbursements
- Track payors and payees
- Check number references
- Automatic balance calculations
- Running balance display

### 🔒 Trust Holds
- Place holds on client funds
- Track hold reasons and amounts
- Release holds when appropriate
- Prevent overdisbursement of held funds
- Available balance calculations

### 📋 Compliance Reports

#### Monthly Trust Account Report
- Period-based transaction summaries
- Opening and closing balances
- Matter-by-matter breakdown
- State-specific compliance notes
- PDF-ready HTML format

#### Three-Way Reconciliation Report
- Bank statement reconciliation
- Client ledger verification
- Trust account register comparison
- Discrepancy identification
- State bar compliance requirements

#### Client Ledger Report
- Individual client fund tracking
- All matters for a client
- Transaction detail with running balance
- Active holds summary
- Available balance calculations

### 📝 Audit Trail
- Automatic logging of all actions
- Transaction creation/modification tracking
- Report generation logging
- User action history
- Compliance documentation

### ⚙️ Settings & Configuration
- Firm name and logo customization
- State bar jurisdiction selection (all 50 states + DC)
- Bank account information (securely masked)
- Trust account details

## State-Specific IOLTA Compliance

The application includes detailed IOLTA compliance rules for the following jurisdictions:

| State | Bar Association | Record Retention | Reconciliation |
|-------|----------------|------------------|----------------|
| Alabama | Alabama State Bar | 6 years | Monthly |
| California | State Bar of California | 5 years | Monthly |
| Colorado | Colorado Bar Association | 7 years | Monthly |
| Florida | The Florida Bar | 6 years | Monthly |
| Georgia | State Bar of Georgia | 6 years | Monthly |
| Illinois | Illinois State Bar Association | 7 years | Monthly |
| Massachusetts | Massachusetts Bar Association | 6 years | Monthly |
| New York | New York State Bar Association | 7 years | Monthly |
| Pennsylvania | Pennsylvania Bar Association | 5 years | Monthly |
| Texas | State Bar of Texas | 5 years | Monthly |
| Washington | Washington State Bar Association | 7 years | Monthly |

States not listed above will use ABA Model Rules as a baseline for compliance guidance.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js
- **Icons**: Lucide React
- **PDF Generation**: React PDF

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL 14+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/CaseMark/iolta-manager.git
cd iolta-manager
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Initialize the database:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── audit/         # Audit log endpoints
│   │   ├── clients/       # Client CRUD operations
│   │   ├── holds/         # Trust holds management
│   │   ├── matters/       # Matter management
│   │   ├── reports/       # Report generation
│   │   ├── settings/      # Firm settings
│   │   └── transactions/  # Transaction operations
│   ├── audit/             # Audit log page
│   ├── clients/           # Client pages
│   ├── holds/             # Holds management page
│   ├── ledger/            # Transaction ledger
│   ├── matters/           # Matter pages
│   ├── reports/           # Reports page
│   └── settings/          # Settings page
├── components/            # React components
│   ├── holds/            # Hold-related components
│   ├── layout/           # Layout components (sidebar)
│   ├── matters/          # Matter-related components
│   ├── reports/          # Report components
│   └── ui/               # Base UI components
├── db/                    # Database configuration
│   ├── index.ts          # Database connection
│   └── schema.ts         # Drizzle schema definitions
└── lib/                   # Utility libraries
    ├── audit.ts          # Audit logging utilities
    ├── iolta-compliance.ts # State-specific IOLTA rules
    ├── pdf-styles.ts     # Report styling
    └── utils.ts          # General utilities
```

## Database Schema

### Tables
- **clients** - Client information
- **matters** - Legal matters linked to clients
- **transactions** - Deposits and disbursements
- **holds** - Trust fund holds
- **trustAccountSettings** - Firm configuration
- **auditLog** - Action history

## Usage Guide

### Setting Up Your Firm

1. Navigate to **Settings**
2. Enter your firm name
3. Upload your firm logo (optional)
4. Select your state bar jurisdiction
5. Enter trust account banking details
6. Save settings

### Adding a Client

1. Go to **Clients** → **New Client**
2. Enter client name and contact information
3. Save the client

### Creating a Matter

1. Go to **Matters** → **New Matter**
2. Select the client
3. Enter matter name and number
4. Save the matter

### Recording Transactions

1. Navigate to a matter's detail page
2. Use the transaction form to record:
   - **Deposits**: Funds received into trust
   - **Disbursements**: Funds paid out
3. Include payor/payee and reference information

### Placing a Hold

1. Go to **Holds** → **New Hold**
2. Select the matter
3. Enter hold amount and reason
4. Save the hold

### Generating Reports

1. Navigate to **Reports**
2. Select report type:
   - Monthly Trust Account Report
   - Reconciliation Report
   - Client Ledger Report
3. Choose date range and filters
4. Generate and download the report

## Security Considerations

- Bank account numbers are masked (only last 4 digits displayed)
- Show/hide toggle for sensitive financial data
- Audit trail for all actions
- No external data transmission (local database)

## Demo Mode

This application ships in **demo mode** for easy evaluation. The demo uses a simple password (`password123`) with no email required.

### Making This Production-Ready

To deploy this for actual use at your firm, you'll need to implement proper authentication, user management, and security hardening. 

**Use the following prompt with [Thurgood](https://thurgood.case.dev) or your AI coding assistant:**

```
Convert this IOLTA application from demo mode to production-ready:

1. AUTHENTICATION:
   - Replace the demo password login with proper email/password authentication
   - Add bcrypt password hashing
   - Implement user registration with email verification
   - Add "Forgot Password" functionality
   - Consider adding OAuth providers (Google, Microsoft) for law firm SSO

2. USER MANAGEMENT:
   - Create a users table with roles (admin, attorney, paralegal, readonly)
   - Add role-based access control (RBAC)
   - Admins can manage users and all settings
   - Attorneys can manage their own matters and transactions
   - Paralegals can view and add transactions but not delete
   - Readonly users can only view reports

3. SECURITY HARDENING:
   - Generate and require a proper NEXTAUTH_SECRET
   - Add CSRF protection
   - Implement session timeout after inactivity
   - Add failed login attempt lockout
   - Enable HTTPS-only cookies
   - Add Content Security Policy headers

4. DATABASE:
   - Configure database connection pooling
   - Implement database backups
   - Set up proper PostgreSQL user permissions

5. AUDIT & COMPLIANCE:
   - Log user identity with all audit entries
   - Add IP address logging
   - Implement data retention policies

6. ENVIRONMENT:
   - Create separate development and production configurations
   - Remove all demo-mode fallbacks
   - Require all secrets via environment variables

Please implement these changes while maintaining the existing functionality.
```

This will transform the demo into a secure, multi-user production application suitable for handling real client trust funds.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please make sure to update tests as appropriate and adhere to the existing code style.

## Compliance Notes

This application is designed to assist with IOLTA compliance but does not constitute legal advice. Always:

- Verify requirements with your state bar association
- Consult the current rules for your jurisdiction
- Maintain additional records as required by your state
- Conduct regular reconciliations as mandated

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

```
Copyright 2024 CaseMark

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## Support

For questions or issues, please open an issue on the [GitHub repository](https://github.com/CaseMark/iolta-manager/issues).
