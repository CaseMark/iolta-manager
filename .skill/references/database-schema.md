# Database Schema Reference

PostgreSQL database managed with Drizzle ORM.

**Schema location**: `src/db/schema.ts`

## Tables

### clients
Law firm clients with contact information.

```typescript
export const clients = pgTable('clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### matters
Legal matters linked to clients.

```typescript
export const matters = pgTable('matters', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  matterNumber: text('matter_number').notNull().unique(),
  description: text('description'),
  status: text('status', { enum: ['open', 'closed'] })
    .notNull()
    .default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### transactions
Trust account deposits and disbursements.

```typescript
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  matterId: uuid('matter_id')
    .notNull()
    .references(() => matters.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['deposit', 'disbursement'] }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  date: date('date').notNull(),
  description: text('description'),
  payorPayee: text('payor_payee'),  // Who paid or received
  checkNumber: text('check_number'),
  reference: text('reference'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### holds
Trust fund holds to reserve client funds.

```typescript
export const holds = pgTable('holds', {
  id: uuid('id').defaultRandom().primaryKey(),
  matterId: uuid('matter_id')
    .notNull()
    .references(() => matters.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['active', 'released'] })
    .notNull()
    .default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  releasedAt: timestamp('released_at'),
});
```

### trustAccountSettings
Firm configuration and bank details.

```typescript
export const trustAccountSettings = pgTable('trust_account_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  firmName: text('firm_name'),
  firmLogo: text('firm_logo'),  // Base64 or URL
  state: text('state'),  // Jurisdiction for compliance rules
  bankName: text('bank_name'),
  accountNumber: text('account_number'),  // Store securely, display masked
  routingNumber: text('routing_number'),
  accountName: text('account_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### auditLog
Compliance audit trail.

```typescript
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  action: text('action').notNull(),  // 'create', 'update', 'delete', 'view'
  entityType: text('entity_type').notNull(),  // 'client', 'matter', 'transaction'
  entityId: uuid('entity_id'),
  details: jsonb('details'),  // Additional context
  userId: uuid('user_id'),  // When auth enabled
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

## Relationships

```typescript
export const clientsRelations = relations(clients, ({ many }) => ({
  matters: many(matters),
}));

export const mattersRelations = relations(matters, ({ one, many }) => ({
  client: one(clients, {
    fields: [matters.clientId],
    references: [clients.id],
  }),
  transactions: many(transactions),
  holds: many(holds),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  matter: one(matters, {
    fields: [transactions.matterId],
    references: [matters.id],
  }),
}));

export const holdsRelations = relations(holds, ({ one }) => ({
  matter: one(matters, {
    fields: [holds.matterId],
    references: [matters.id],
  }),
}));
```

## Common Queries

### Get matter balance
```typescript
const transactions = await db
  .select({
    type: transactions.type,
    amount: transactions.amount,
  })
  .from(transactions)
  .where(eq(transactions.matterId, matterId));

const balance = transactions.reduce((acc, t) => {
  const amount = parseFloat(t.amount);
  return t.type === 'deposit' ? acc + amount : acc - amount;
}, 0);
```

### Get available balance (minus holds)
```typescript
const activeHolds = await db
  .select({ amount: holds.amount })
  .from(holds)
  .where(
    and(
      eq(holds.matterId, matterId),
      eq(holds.status, 'active')
    )
  );

const holdTotal = activeHolds.reduce(
  (acc, h) => acc + parseFloat(h.amount), 0
);
const availableBalance = balance - holdTotal;
```

### Get transactions with running balance
```typescript
const txns = await db
  .select()
  .from(transactions)
  .where(eq(transactions.matterId, matterId))
  .orderBy(asc(transactions.date), asc(transactions.createdAt));

let runningBalance = 0;
const withBalance = txns.map(t => {
  const amount = parseFloat(t.amount);
  runningBalance += t.type === 'deposit' ? amount : -amount;
  return { ...t, runningBalance };
});
```

### Log audit entry
```typescript
await db.insert(auditLog).values({
  action: 'create',
  entityType: 'transaction',
  entityId: transactionId,
  details: { amount, type, matterId },
});
```

## Type Exports

```typescript
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Matter = typeof matters.$inferSelect;
export type NewMatter = typeof matters.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Hold = typeof holds.$inferSelect;
export type NewHold = typeof holds.$inferInsert;
```

## Commands

```bash
npm run db:push      # Apply schema directly (dev)
npm run db:generate  # Create migration files
npm run db:studio    # Visual database browser
```
