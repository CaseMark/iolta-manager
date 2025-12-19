import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';

// Clients table - stores client information
export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  notes: text('notes'),
  status: text('status').default('active'), // active, inactive, archived
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

// Matters table - stores case/matter information
export const matters = pgTable('matters', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull().references(() => clients.id),
  name: text('name').notNull(), // e.g., "Smith v. Jones"
  matterNumber: text('matter_number').unique(),
  description: text('description'),
  status: text('status').default('open'), // open, closed, pending
  practiceArea: text('practice_area'),
  responsibleAttorney: text('responsible_attorney'),
  openDate: timestamp('open_date').notNull(),
  closeDate: timestamp('close_date'),
  // Case.dev integration - for future use
  casedevAccountId: text('casedev_account_id'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

// Transactions table - stores all financial transactions
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  matterId: text('matter_id').notNull().references(() => matters.id),
  casedevTransactionId: text('casedev_transaction_id'),
  type: text('type').notNull(), // deposit, disbursement, transfer
  amount: integer('amount').notNull(), // Amount in cents
  description: text('description').notNull(),
  payee: text('payee'), // For disbursements
  payor: text('payor'), // For deposits
  checkNumber: text('check_number'),
  reference: text('reference'),
  status: text('status').default('completed'), // pending, completed, cancelled
  createdAt: timestamp('created_at').notNull(),
  createdBy: text('created_by'),
});

// Holds table - tracks holds on account funds
export const holds = pgTable('holds', {
  id: text('id').primaryKey(),
  matterId: text('matter_id').notNull().references(() => matters.id),
  casedevHoldId: text('casedev_hold_id'),
  amount: integer('amount').notNull(), // Amount in cents
  type: text('type').notNull(), // retainer, settlement, escrow, compliance
  description: text('description').notNull(),
  status: text('status').default('active'), // active, released, cancelled
  createdAt: timestamp('created_at').notNull(),
  releasedAt: timestamp('released_at'),
  releasedBy: text('released_by'),
  releaseReason: text('release_reason'),
});

// Audit logs table - comprehensive audit trail
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(), // client, matter, transaction, hold, report
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // create, update, delete, view, export
  details: text('details'), // JSON string with change details
  userId: text('user_id'),
  userEmail: text('user_email'),
  ipAddress: text('ip_address'),
  timestamp: timestamp('timestamp').notNull(),
});

// Report history table - tracks generated reports
export const reportHistory = pgTable('report_history', {
  id: text('id').primaryKey(),
  reportType: text('report_type').notNull(), // monthly_trust, client_ledger, reconciliation
  reportName: text('report_name').notNull(),
  parameters: text('parameters'), // JSON string with report parameters
  generatedAt: timestamp('generated_at').notNull(),
  generatedBy: text('generated_by'),
  filePath: text('file_path'),
  status: text('status').default('completed'), // pending, completed, failed
});

// Trust account settings
export const trustAccountSettings = pgTable('trust_account_settings', {
  id: text('id').primaryKey(),
  firmName: text('firm_name'),
  firmLogo: text('firm_logo'), // Base64 encoded logo image
  bankName: text('bank_name'),
  accountNumber: text('account_number'),
  routingNumber: text('routing_number'),
  casedevTrustAccountId: text('casedev_trust_account_id'),
  casedevOperatingAccountId: text('casedev_operating_account_id'),
  state: text('state'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

// Type exports for use in the application
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Matter = typeof matters.$inferSelect;
export type NewMatter = typeof matters.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Hold = typeof holds.$inferSelect;
export type NewHold = typeof holds.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type ReportHistory = typeof reportHistory.$inferSelect;
export type NewReportHistory = typeof reportHistory.$inferInsert;

export type TrustAccountSettings = typeof trustAccountSettings.$inferSelect;
export type NewTrustAccountSettings = typeof trustAccountSettings.$inferInsert;
