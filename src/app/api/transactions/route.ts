import { NextRequest, NextResponse } from 'next/server';
import { db, transactions, matters, holds, clients } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';
import { getCaseDevService, CaseDevApiException } from '@/lib/casedev';
import { z } from 'zod';

// Validation schema for creating a transaction
const createTransactionSchema = z.object({
  matterId: z.string().uuid('Invalid matter ID'),
  type: z.enum(['deposit', 'disbursement'], { 
    errorMap: () => ({ message: 'Type must be deposit or disbursement' })
  }),
  amount: z.number().positive('Amount must be greater than 0').max(100000000, 'Amount exceeds maximum'),
  description: z.string().min(1, 'Description is required').max(500),
  payee: z.string().max(255).optional().nullable(),
  payor: z.string().max(255).optional().nullable(),
  checkNumber: z.string().max(50).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
});

// GET /api/transactions - List all transactions with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matterId = searchParams.get('matterId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = db
      .select({
        id: transactions.id,
        matterId: transactions.matterId,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        payee: transactions.payee,
        payor: transactions.payor,
        checkNumber: transactions.checkNumber,
        reference: transactions.reference,
        status: transactions.status,
        createdAt: transactions.createdAt,
        matterName: matters.name,
        matterNumber: matters.matterNumber,
        clientId: matters.clientId,
        clientName: clients.name,
      })
      .from(transactions)
      .leftJoin(matters, eq(transactions.matterId, matters.id))
      .leftJoin(clients, eq(matters.clientId, clients.id))
      .orderBy(desc(transactions.createdAt))
      .$dynamic();

    const conditions = [];

    if (matterId) {
      conditions.push(eq(transactions.matterId, matterId));
    }

    if (type) {
      conditions.push(eq(transactions.type, type));
    }

    if (startDate) {
      conditions.push(gte(transactions.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(transactions.createdAt, new Date(endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const allTransactions = await query;

    // Calculate running balance
    let runningBalance = 0;
    const transactionsWithBalance = [...allTransactions].reverse().map((txn) => {
      if (txn.type === 'deposit') {
        runningBalance += txn.amount;
      } else {
        runningBalance -= txn.amount;
      }
      return {
        ...txn,
        runningBalance,
      };
    }).reverse();

    return NextResponse.json(transactionsWithBalance);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST /api/transactions - Create a new transaction (deposit or disbursement)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = createTransactionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { 
      matterId, 
      type, 
      amount, 
      description, 
      payee, 
      payor, 
      checkNumber, 
      reference 
    } = validationResult.data;

    // Verify matter exists and is open
    const matter = await db
      .select()
      .from(matters)
      .where(eq(matters.id, matterId))
      .limit(1);

    if (matter.length === 0) {
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    if (matter[0].status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot add transactions to a closed matter' },
        { status: 400 }
      );
    }

    // Get Case.dev service for secure balance verification
    const casedevService = await getCaseDevService();
    const hasCasedevAccount = !!(matter[0].casedevAccountId && casedevService?.isConfigured());

    // For disbursements, check if there's sufficient AVAILABLE balance (balance - active holds)
    // Per Case.dev trust accounting: Available Balance = Balance - Active Holds
    if (type === 'disbursement') {
      // If Case.dev is configured and matter has a sub-account, verify with Case.dev
      if (hasCasedevAccount && casedevService) {
        try {
          const verification = await casedevService.verifyAvailableFunds(
            matter[0].casedevAccountId!,
            Math.round(amount)
          );
          
          if (!verification.sufficient) {
            return NextResponse.json(
              { 
                error: `Insufficient available funds (verified by Case.dev). Balance: ${verification.balance / 100}, Held: ${verification.held / 100}, Available: ${verification.available / 100}, Requested: ${amount / 100}, Shortfall: ${verification.shortfall / 100}`,
                casedevVerified: true,
              },
              { status: 400 }
            );
          }
        } catch (error) {
          if (error instanceof CaseDevApiException) {
            console.error('Case.dev verification error:', error);
            // Fall back to local verification if Case.dev fails
          } else {
            throw error;
          }
        }
      }

      // Local balance verification (fallback or primary if Case.dev not configured)
      const balanceResult = await db
        .select({
          deposits: sql<number>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)`,
          disbursements: sql<number>`COALESCE(SUM(CASE WHEN type = 'disbursement' THEN amount ELSE 0 END), 0)`,
        })
        .from(transactions)
        .where(eq(transactions.matterId, matterId));

      const currentBalance = (balanceResult[0]?.deposits || 0) - (balanceResult[0]?.disbursements || 0);

      // Get current active holds
      const activeHoldsResult = await db
        .select({
          totalHolds: sql<number>`COALESCE(SUM(amount), 0)`,
        })
        .from(holds)
        .where(and(
          eq(holds.matterId, matterId),
          eq(holds.status, 'active')
        ));

      const currentHolds = activeHoldsResult[0]?.totalHolds || 0;
      const availableBalance = currentBalance - currentHolds;

      if (amount > availableBalance) {
        return NextResponse.json(
          { error: `Insufficient available funds. Balance: ${currentBalance}, Active Holds: ${currentHolds}, Available: ${availableBalance}, Requested: ${amount}` },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const transactionId = uuidv4();
    const amountInCents = Math.round(amount);
    
    // Attempt to record transaction in Case.dev for secure trust accounting
    let casedevTransactionId: string | null = null;
    if (hasCasedevAccount && casedevService) {
      try {
        if (type === 'deposit') {
          // Create charge (deposit) in Case.dev
          const charge = await casedevService.createCharge({
            accountId: matter[0].casedevAccountId!,
            amount: amountInCents,
            description,
            payor: payor || undefined,
            reference: reference || undefined,
          });
          casedevTransactionId = charge.id;
          console.log(`Created Case.dev charge: ${charge.id} for transaction ${transactionId}`);
        } else if (type === 'disbursement') {
          // Create transfer (disbursement) in Case.dev
          const transfer = await casedevService.createDisbursementToOperating({
            fromAccountId: matter[0].casedevAccountId!,
            amount: amountInCents,
            description,
            payee: payee || undefined,
            checkNumber: checkNumber || undefined,
            requiresApproval: false, // Auto-approve for now
          });
          casedevTransactionId = transfer.id;
          console.log(`Created Case.dev transfer: ${transfer.id} for transaction ${transactionId}`);
        }
      } catch (error) {
        if (error instanceof CaseDevApiException) {
          console.error('Failed to record transaction in Case.dev:', error);
          // For deposits, continue without Case.dev
          // For disbursements, we should be more strict
          if (type === 'disbursement') {
            return NextResponse.json(
              { 
                error: `Failed to process disbursement through Case.dev: ${error.message}`,
                code: error.code,
              },
              { status: 500 }
            );
          }
        } else {
          throw error;
        }
      }
    }

    const newTransaction = {
      id: transactionId,
      matterId,
      casedevTransactionId,
      type,
      amount: amountInCents,
      description,
      payee: payee || null,
      payor: payor || null,
      checkNumber: checkNumber || null,
      reference: reference || null,
      status: 'completed',
      createdAt: now,
      createdBy: null,
    };

    await db.insert(transactions).values(newTransaction);

    // Log audit event
    await logAuditEvent({
      entityType: 'transaction',
      entityId: newTransaction.id,
      action: 'create',
      details: { 
        type,
        amount,
        description,
        matterId,
        matterName: matter[0].name,
        payee,
        payor,
        checkNumber,
        casedevTransactionId,
        casedevVerified: hasCasedevAccount,
      },
    });

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
