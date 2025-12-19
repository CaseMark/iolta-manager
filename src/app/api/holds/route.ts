import { NextRequest, NextResponse } from 'next/server';
import { db, holds, matters, clients, transactions } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import { desc, eq, sql, and } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';
import { getCaseDevService, CaseDevApiException } from '@/lib/casedev';

// GET /api/holds - List all holds with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matterId = searchParams.get('matterId');
    const status = searchParams.get('status');

    let query = db
      .select({
        id: holds.id,
        matterId: holds.matterId,
        amount: holds.amount,
        type: holds.type,
        description: holds.description,
        status: holds.status,
        createdAt: holds.createdAt,
        releasedAt: holds.releasedAt,
        releasedBy: holds.releasedBy,
        releaseReason: holds.releaseReason,
        matterName: matters.name,
        matterNumber: matters.matterNumber,
        clientName: clients.name,
      })
      .from(holds)
      .leftJoin(matters, eq(holds.matterId, matters.id))
      .leftJoin(clients, eq(matters.clientId, clients.id))
      .orderBy(desc(holds.createdAt))
      .$dynamic();

    const conditions = [];

    if (matterId) {
      conditions.push(eq(holds.matterId, matterId));
    }

    if (status) {
      conditions.push(eq(holds.status, status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const allHolds = await query;

    return NextResponse.json(allHolds);
  } catch (error) {
    console.error('Error fetching holds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch holds' },
      { status: 500 }
    );
  }
}

// POST /api/holds - Create a new hold
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matterId, amount, type, description } = body;

    if (!matterId) {
      return NextResponse.json(
        { error: 'Matter ID is required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid positive amount is required' },
        { status: 400 }
      );
    }

    if (!type || !['retainer', 'settlement', 'escrow', 'compliance'].includes(type)) {
      return NextResponse.json(
        { error: 'Valid hold type (retainer, settlement, escrow, compliance) is required' },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

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
        { error: 'Cannot add holds to a closed matter' },
        { status: 400 }
      );
    }

    // Get current balance
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

    // Check if hold amount exceeds available balance
    if (amount > availableBalance) {
      return NextResponse.json(
        { error: `Insufficient available funds. Available balance: ${availableBalance}, Requested hold: ${amount}` },
        { status: 400 }
      );
    }

    const now = new Date();
    const holdId = uuidv4();
    const amountInCents = Math.round(amount);
    
    // Attempt to create hold in Case.dev for secure trust accounting
    let casedevHoldId: string | null = null;
    const casedevService = await getCaseDevService();
    const hasCasedevAccount = !!(matter[0].casedevAccountId && casedevService?.isConfigured());
    
    if (hasCasedevAccount && casedevService) {
      try {
        const casedevHold = await casedevService.createHold({
          accountId: matter[0].casedevAccountId!,
          amount: amountInCents,
          type: type as 'retainer' | 'settlement' | 'escrow' | 'compliance',
          description,
        });
        casedevHoldId = casedevHold.id;
        console.log(`Created Case.dev hold: ${casedevHold.id} for local hold ${holdId}`);
      } catch (error) {
        if (error instanceof CaseDevApiException) {
          console.error('Failed to create hold in Case.dev:', error);
          // Continue with local hold creation
        } else {
          throw error;
        }
      }
    }

    const newHold = {
      id: holdId,
      matterId,
      casedevHoldId,
      amount: amountInCents,
      type,
      description,
      status: 'active',
      createdAt: now,
      releasedAt: null,
      releasedBy: null,
      releaseReason: null,
    };

    await db.insert(holds).values(newHold);

    // Log audit event
    await logAuditEvent({
      entityType: 'hold',
      entityId: newHold.id,
      action: 'create',
      details: { 
        type,
        amount,
        description,
        matterId,
        matterName: matter[0].name,
        casedevHoldId,
        casedevSynced: !!casedevHoldId,
      },
    });

    return NextResponse.json(newHold, { status: 201 });
  } catch (error) {
    console.error('Error creating hold:', error);
    return NextResponse.json(
      { error: 'Failed to create hold' },
      { status: 500 }
    );
  }
}
