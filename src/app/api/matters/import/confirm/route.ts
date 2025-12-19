import { NextRequest, NextResponse } from 'next/server';
import { db, clients, matters, transactions, holds } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';

// Define the structure for imported matter data
interface ImportedMatterData {
  matter: {
    name: string;
    matterNumber?: string;
    matterType?: string;
    description?: string;
    status?: string;
    openDate?: string;
    responsibleAttorney?: string;
    practiceArea?: string;
    court?: string;
    courtCaseNumber?: string;
    opposingParty?: string;
    opposingCounsel?: string;
  };
  client: {
    id?: string; // If using existing client
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  transactions: Array<{
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
  }>;
  holds: Array<{
    type: string;
    amount: number;
    description: string;
    status: 'active' | 'released';
    createdDate?: string;
    notes?: string;
  }>;
  useExistingClient?: boolean;
  existingClientId?: string;
}

// POST /api/matters/import/confirm - Save the imported matter data
export async function POST(request: NextRequest) {
  try {
    const body: ImportedMatterData = await request.json();
    const { matter, client, transactions: txns, holds: holdsList, useExistingClient, existingClientId } = body;

    // Validate required fields
    if (!matter?.name) {
      return NextResponse.json(
        { error: 'Matter name is required' },
        { status: 400 }
      );
    }

    if (!useExistingClient && !client?.name) {
      return NextResponse.json(
        { error: 'Client name is required when creating a new client' },
        { status: 400 }
      );
    }

    const now = new Date();
    let clientId: string;

    // Handle client creation or selection
    if (useExistingClient && existingClientId) {
      // Verify the client exists
      const existingClient = await db
        .select()
        .from(clients)
        .where(eq(clients.id, existingClientId))
        .limit(1);

      if (existingClient.length === 0) {
        return NextResponse.json(
          { error: 'Selected client not found' },
          { status: 404 }
        );
      }

      clientId = existingClientId;
    } else {
      // Create new client
      clientId = uuidv4();
      const newClient = {
        id: clientId,
        name: client.name,
        email: client.email || null,
        phone: client.phone || null,
        address: client.address || null,
        notes: null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(clients).values(newClient);

      // Log audit event for client creation
      await logAuditEvent({
        entityType: 'client',
        entityId: clientId,
        action: 'create',
        details: {
          name: client.name,
          source: 'import',
        },
      });
    }

    // Generate matter number if not provided
    const matterNumber = matter.matterNumber || `MAT-${Date.now().toString(36).toUpperCase()}`;

    // Parse open date
    let openDate = now;
    if (matter.openDate) {
      const parsed = new Date(matter.openDate);
      if (!isNaN(parsed.getTime())) {
        openDate = parsed;
      }
    }

    // Create the matter
    const matterId = uuidv4();
    const newMatter = {
      id: matterId,
      clientId,
      name: matter.name,
      matterNumber,
      description: matter.description || null,
      status: matter.status === 'closed' ? 'closed' : 'open',
      practiceArea: matter.practiceArea || matter.matterType || null,
      responsibleAttorney: matter.responsibleAttorney || null,
      openDate,
      closeDate: null,
      casedevAccountId: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(matters).values(newMatter);

    // Log audit event for matter creation
    await logAuditEvent({
      entityType: 'matter',
      entityId: matterId,
      action: 'create',
      details: {
        name: matter.name,
        matterNumber,
        clientId,
        source: 'import',
        transactionCount: txns?.length || 0,
        holdsCount: holdsList?.length || 0,
      },
    });

    // Create transactions
    const createdTransactions: string[] = [];
    if (txns && txns.length > 0) {
      for (const txn of txns) {
        // Parse transaction date
        let txnDate = now;
        if (txn.date) {
          const parsed = new Date(txn.date);
          if (!isNaN(parsed.getTime())) {
            txnDate = parsed;
          }
        }

        // Convert amount to cents (amounts come in as dollars)
        const amountInCents = Math.round(txn.amount * 100);

        const txnId = uuidv4();
        const newTransaction = {
          id: txnId,
          matterId,
          casedevTransactionId: null,
          type: txn.type,
          amount: amountInCents,
          description: txn.description,
          payee: txn.payee || null,
          payor: txn.payor || null,
          checkNumber: txn.checkNumber || null,
          reference: txn.reference || null,
          status: 'completed',
          createdAt: txnDate,
          createdBy: null,
        };

        await db.insert(transactions).values(newTransaction);
        createdTransactions.push(txnId);

        // Log audit event for transaction
        await logAuditEvent({
          entityType: 'transaction',
          entityId: txnId,
          action: 'create',
          details: {
            type: txn.type,
            amount: amountInCents,
            description: txn.description,
            matterId,
            source: 'import',
          },
        });
      }
    }

    // Create holds
    const createdHolds: string[] = [];
    if (holdsList && holdsList.length > 0) {
      for (const hold of holdsList) {
        // Only create active holds
        if (hold.status !== 'active') continue;

        // Parse hold date
        let holdDate = now;
        if (hold.createdDate) {
          const parsed = new Date(hold.createdDate);
          if (!isNaN(parsed.getTime())) {
            holdDate = parsed;
          }
        }

        // Convert amount to cents
        const amountInCents = Math.round(hold.amount * 100);

        // Map hold type to valid types
        let holdType = hold.type.toLowerCase();
        if (!['retainer', 'settlement', 'escrow', 'compliance'].includes(holdType)) {
          // Try to map common variations
          if (holdType.includes('retainer') || holdType.includes('unearned')) {
            holdType = 'retainer';
          } else if (holdType.includes('settlement')) {
            holdType = 'settlement';
          } else if (holdType.includes('escrow')) {
            holdType = 'escrow';
          } else {
            holdType = 'compliance'; // Default
          }
        }

        const holdId = uuidv4();
        const newHold = {
          id: holdId,
          matterId,
          casedevHoldId: null,
          amount: amountInCents,
          type: holdType,
          description: hold.description + (hold.notes ? ` - ${hold.notes}` : ''),
          status: 'active',
          createdAt: holdDate,
          releasedAt: null,
          releasedBy: null,
          releaseReason: null,
        };

        await db.insert(holds).values(newHold);
        createdHolds.push(holdId);

        // Log audit event for hold
        await logAuditEvent({
          entityType: 'hold',
          entityId: holdId,
          action: 'create',
          details: {
            type: holdType,
            amount: amountInCents,
            description: hold.description,
            matterId,
            source: 'import',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      matter: {
        id: matterId,
        name: matter.name,
        matterNumber,
      },
      client: {
        id: clientId,
        isNew: !useExistingClient,
      },
      transactionsCreated: createdTransactions.length,
      holdsCreated: createdHolds.length,
    }, { status: 201 });

  } catch (error) {
    console.error('Error confirming matter import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save imported matter' },
      { status: 500 }
    );
  }
}
