# IOLTA Manager Skill

Agent skill for developing the iolta-manager trust account application.

## Directory Structure

```
.skill/
├── SKILL.md                        # Core skill (always read first)
└── references/
    ├── database-schema.md          # Drizzle ORM schema
    ├── iolta-compliance.md         # State-specific IOLTA rules
    └── reporting.md                # Report generation patterns
```

---

## File Descriptions

### SKILL.md
**Purpose**: Primary entry point for the skill

**Contains**:
- Application architecture overview
- Tech stack summary (Next.js 15, PostgreSQL, Drizzle, NextAuth)
- Core workflow (clients → matters → transactions → holds → reports)
- Feature summary (dashboard, compliance reports, audit trail)
- Development setup commands
- Common task patterns
- Troubleshooting table

**When loaded**: Automatically when skill triggers on queries about iolta-manager, trust accounts, client funds, or IOLTA compliance

**Size**: ~150 lines

---

### references/database-schema.md
**Purpose**: Drizzle ORM schema reference

**Contains**:
- Complete table definitions: clients, matters, transactions, holds, settings, auditLog
- Relationship definitions
- Common queries (balance calculation, running balance, available balance)
- Hold management queries
- Audit logging patterns
- Type exports

**When to read**: Modifying database schema, writing queries, adding new tables

**Size**: ~180 lines

---

### references/iolta-compliance.md
**Purpose**: IOLTA regulatory compliance documentation

**Contains**:
- IOLTA fundamentals (what it is, why it matters)
- Three-way reconciliation explanation
- Record retention requirements by state
- All 50 states + DC compliance table
- Prohibited actions and common violations
- Hold and available balance rules
- Audit trail requirements
- Application feature mapping to compliance needs

**When to read**: Adding compliance features, understanding IOLTA rules, building state-specific logic

**Size**: ~250 lines

---

### references/reporting.md
**Purpose**: Report generation patterns and templates

**Contains**:
- Three report types: Monthly, Reconciliation, Client Ledger
- API endpoint definitions
- Request/response TypeScript interfaces
- Generation algorithm patterns
- React component templates
- PDF styling configuration
- Utility functions (currency, date formatting)
- Export options (print, PDF)
- Audit logging for reports

**When to read**: Building new reports, modifying report formats, adding export options

**Size**: ~200 lines

---

## Progressive Disclosure

| Level | What Loads | Token Cost |
|-------|------------|------------|
| 1 | Frontmatter (name + description) | ~60 tokens |
| 2 | SKILL.md body | ~900 tokens |
| 3 | Reference files (as needed) | ~500-700 tokens each |

---

## Installation

```bash
cd iolta-manager
mkdir -p .skill/references
# Copy files into place
git add .skill/
git commit -m "Add agent skill for iolta-manager development"
```

---

## Trigger Examples

| Query | Loads |
|-------|-------|
| "Fix the transaction form validation" | SKILL.md only |
| "Add a new report for quarterly summaries" | SKILL.md + reporting.md |
| "Store hold release dates in the database" | SKILL.md + database-schema.md |
| "What are California's IOLTA requirements?" | SKILL.md + iolta-compliance.md |
| "Build three-way reconciliation feature" | SKILL.md + reporting.md + iolta-compliance.md |
