import { NextRequest, NextResponse } from 'next/server';
import { db, matters, transactions, holds } from '@/db';
import { eq } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';
import { randomUUID } from 'crypto';

interface TransactionToImport {
  date: string;
  type: 'deposit' | 'disbursement';
  category?: string;
  description: string;
  amount: number;
  payee?: string;
  payor?: string;
  checkNumber?: string;
  reference?: string;
  paymentMethod?: string;
  selected?: boolean;
}

interface HoldToImport {
  type: string;
  amount: number;
  description: string;
  status: 'active' | 'released';
  createdDate?: string;
  expectedReleaseDate?: string;
  releaseConditions?: string;
  notes?: string;
  selected?: boolean;
}

interface ImportRequest {
  transactions: TransactionToImport[];
  holds: HoldToImport[];
  sourceFile?: string;
}

// POST /api/matters/[id]/analyze/confirm - Import selected transactions and holds
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: matterId } = await params;
  
  try {
    // Verify matter exists
    const matterResult = await db
      .select()
      .from(matters)
      .where(eq(matters.id, matterId))
      .limit(1);

    if (matterResult.length === 0) {
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    const matter = matterResult[0];

    // Check if matter is closed
    if (matter.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot import data to a closed matter' },
        { status: 400 }
      );
    }

    const body: ImportRequest = await request.json();
    const { transactions: txnsToImport, holds: holdsToImport, sourceFile } = body;

    // Filter to only selected items
    const selectedTransactions = txnsToImport.filter(t => t.selected !== false);
    const selectedHolds = holdsToImport.filter(h => h.selected !== false);

    const importedTransactions: string[] = [];
    const importedHolds: string[] = [];
    const errors: string[] = [];

    // Import transactions
    for (const txn of selectedTransactions) {
      try {
        // Convert amount to cents
        const amountInCents = Math.round(txn.amount * 100);

        // Parse date
        const txnDate = new Date(txn.date);
        if (isNaN(txnDate.getTime())) {
          errors.push(`Invalid date for transaction: ${txn.description}`);
          continue;
        }

        const txnId = randomUUID();
        const [newTxn] = await db
          .insert(transactions)
          .values({
            id: txnId,
            matterId,
            type: txn.type,
            amount: amountInCents,
            description: txn.description,
            payee: txn.payee || null,
            payor: txn.payor || null,
            checkNumber: txn.checkNumber || null,
            reference: txn.reference || null,
            createdAt: txnDate,
          })
          .returning();

        importedTransactions.push(newTxn.id);

        // Log audit event for each transaction
        await logAuditEvent({
          entityType: 'transaction',
          entityId: newTxn.id,
          action: 'create',
          details: {
            source: 'document_import',
            sourceFile,
            matterId,
            type: txn.type,
            amount: amountInCents,
            description: txn.description,
          },
        });
      } catch (error) {
        console.error('Error importing transaction:', error);
        errors.push(`Failed to import transaction: ${txn.description}`);
      }
    }

    // Import holds
    for (const hold of selectedHolds) {
      try {
        // Convert amount to cents
        const amountInCents = Math.round(hold.amount * 100);

        // Parse dates
        const createdDate = hold.createdDate ? new Date(hold.createdDate) : new Date();

        // Map hold type
        const holdType = mapHoldType(hold.type);

        const holdId = randomUUID();
        const [newHold] = await db
          .insert(holds)
          .values({
            id: holdId,
            matterId,
            casedevHoldId: null,
            type: holdType,
            amount: amountInCents,
            description: hold.description + (hold.notes ? ` - ${hold.notes}` : ''),
            status: hold.status,
            createdAt: createdDate,
            releasedAt: null,
            releasedBy: null,
            releaseReason: hold.releaseConditions || null,
          })
          .returning();

        importedHolds.push(newHold.id);

        // Log audit event for each hold
        await logAuditEvent({
          entityType: 'hold',
          entityId: newHold.id,
          action: 'create',
          details: {
            source: 'document_import',
            sourceFile,
            matterId,
            type: holdType,
            amount: amountInCents,
            description: hold.description,
            status: hold.status,
          },
        });
      } catch (error) {
        console.error('Error importing hold:', error);
        errors.push(`Failed to import hold: ${hold.description}`);
      }
    }

    // Log overall import audit event
    await logAuditEvent({
      entityType: 'matter',
      entityId: matterId,
      action: 'update',
      details: {
        action: 'document_import_completed',
        sourceFile,
        transactionsImported: importedTransactions.length,
        holdsImported: importedHolds.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      imported: {
        transactions: importedTransactions.length,
        holds: importedHolds.length,
      },
      transactionIds: importedTransactions,
      holdIds: importedHolds,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error confirming import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import data' },
      { status: 500 }
    );
  }
}

// Map various hold type strings to our standard types
function mapHoldType(type: string): 'retainer' | 'settlement' | 'escrow' | 'compliance' | 'other' {
  const normalizedType = type.toLowerCase().trim();
  
  if (normalizedType.includes('retainer')) return 'retainer';
  if (normalizedType.includes('settlement')) return 'settlement';
  if (normalizedType.includes('escrow')) return 'escrow';
  if (normalizedType.includes('compliance') || normalizedType.includes('regulatory')) return 'compliance';
  
  return 'other';
}
