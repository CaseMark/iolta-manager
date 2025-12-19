import { NextRequest, NextResponse } from 'next/server';
import { db, matters, clients, transactions } from '@/db';
import { eq, sql, desc } from 'drizzle-orm';
import { logAuditEvent, getChanges } from '@/lib/audit';

// GET /api/matters/[id] - Get a single matter with details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matter = await db
      .select({
        id: matters.id,
        clientId: matters.clientId,
        name: matters.name,
        matterNumber: matters.matterNumber,
        description: matters.description,
        status: matters.status,
        practiceArea: matters.practiceArea,
        responsibleAttorney: matters.responsibleAttorney,
        openDate: matters.openDate,
        closeDate: matters.closeDate,
        createdAt: matters.createdAt,
        updatedAt: matters.updatedAt,
        clientName: clients.name,
        clientEmail: clients.email,
      })
      .from(matters)
      .leftJoin(clients, eq(matters.clientId, clients.id))
      .where(eq(matters.id, params.id))
      .limit(1);

    if (matter.length === 0) {
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    // Get balance
    const balanceResult = await db
      .select({
        deposits: sql<number>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)`,
        disbursements: sql<number>`COALESCE(SUM(CASE WHEN type = 'disbursement' THEN amount ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.matterId, params.id));

    const deposits = balanceResult[0]?.deposits || 0;
    const disbursements = balanceResult[0]?.disbursements || 0;
    const balance = deposits - disbursements;

    // Get transactions for this matter
    const matterTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.matterId, params.id))
      .orderBy(desc(transactions.createdAt));

    return NextResponse.json({
      ...matter[0],
      balance,
      totalDeposits: deposits,
      totalDisbursements: disbursements,
      transactions: matterTransactions,
    });
  } catch (error) {
    console.error('Error fetching matter:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matter' },
      { status: 500 }
    );
  }
}

// PUT /api/matters/[id] - Update a matter
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, status, practiceArea, responsibleAttorney } = body;

    const existingMatter = await db
      .select()
      .from(matters)
      .where(eq(matters.id, params.id))
      .limit(1);

    if (existingMatter.length === 0) {
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'closed') {
        updateData.closeDate = new Date();
      }
    }
    if (practiceArea !== undefined) updateData.practiceArea = practiceArea;
    if (responsibleAttorney !== undefined) updateData.responsibleAttorney = responsibleAttorney;

    const updatedMatter = await db
      .update(matters)
      .set(updateData)
      .where(eq(matters.id, params.id))
      .returning();

    // Log audit event with changes
    const changes = getChanges(
      existingMatter[0] as Record<string, unknown>,
      updateData,
      ['name', 'description', 'status', 'practiceArea', 'responsibleAttorney']
    );
    
    if (Object.keys(changes).length > 0) {
      await logAuditEvent({
        entityType: 'matter',
        entityId: params.id,
        action: 'update',
        details: { 
          matterName: existingMatter[0].name,
          changes,
        },
      });
    }

    return NextResponse.json(updatedMatter[0]);
  } catch (error) {
    console.error('Error updating matter:', error);
    return NextResponse.json(
      { error: 'Failed to update matter' },
      { status: 500 }
    );
  }
}

// DELETE /api/matters/[id] - Close a matter
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existingMatter = await db
      .select()
      .from(matters)
      .where(eq(matters.id, params.id))
      .limit(1);

    if (existingMatter.length === 0) {
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    // Check if matter has a balance
    const balanceResult = await db
      .select({
        deposits: sql<number>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)`,
        disbursements: sql<number>`COALESCE(SUM(CASE WHEN type = 'disbursement' THEN amount ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.matterId, params.id));

    const balance = (balanceResult[0]?.deposits || 0) - (balanceResult[0]?.disbursements || 0);

    if (balance !== 0) {
      return NextResponse.json(
        { error: 'Cannot close matter with non-zero balance. Current balance: ' + balance },
        { status: 400 }
      );
    }

    // Close the matter
    await db
      .update(matters)
      .set({
        status: 'closed',
        closeDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(matters.id, params.id));

    // Log audit event
    await logAuditEvent({
      entityType: 'matter',
      entityId: params.id,
      action: 'delete',
      details: { 
        matterName: existingMatter[0].name,
        matterNumber: existingMatter[0].matterNumber,
        previousStatus: existingMatter[0].status,
        action: 'closed',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error closing matter:', error);
    return NextResponse.json(
      { error: 'Failed to close matter' },
      { status: 500 }
    );
  }
}
