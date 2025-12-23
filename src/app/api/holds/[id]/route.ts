import { NextRequest, NextResponse } from 'next/server';
import { db, holds, matters } from '@/db';
import { eq } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';

// GET /api/holds/[id] - Get a single hold
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const hold = await db
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
      })
      .from(holds)
      .leftJoin(matters, eq(holds.matterId, matters.id))
      .where(eq(holds.id, id))
      .limit(1);

    if (hold.length === 0) {
      return NextResponse.json(
        { error: 'Hold not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(hold[0]);
  } catch (error) {
    console.error('Error fetching hold:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hold' },
      { status: 500 }
    );
  }
}

// PUT /api/holds/[id] - Update a hold (for status changes)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { status, releaseReason, releasedBy } = body;

    const existingHold = await db
      .select()
      .from(holds)
      .where(eq(holds.id, id))
      .limit(1);

    if (existingHold.length === 0) {
      return NextResponse.json(
        { error: 'Hold not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status !== undefined) {
      updateData.status = status;
      
      if (status === 'released') {
        updateData.releasedAt = new Date();
        updateData.releasedBy = releasedBy || null;
        updateData.releaseReason = releaseReason || null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existingHold[0]);
    }

    const updatedHold = await db
      .update(holds)
      .set(updateData)
      .where(eq(holds.id, id))
      .returning();

    // Log audit event
    await logAuditEvent({
      entityType: 'hold',
      entityId: id,
      action: 'update',
      details: { 
        previousStatus: existingHold[0].status,
        newStatus: status,
        releaseReason,
        amount: existingHold[0].amount,
      },
    });

    return NextResponse.json(updatedHold[0]);
  } catch (error) {
    console.error('Error updating hold:', error);
    return NextResponse.json(
      { error: 'Failed to update hold' },
      { status: 500 }
    );
  }
}

// DELETE /api/holds/[id] - Cancel a hold
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const existingHold = await db
      .select()
      .from(holds)
      .where(eq(holds.id, id))
      .limit(1);

    if (existingHold.length === 0) {
      return NextResponse.json(
        { error: 'Hold not found' },
        { status: 404 }
      );
    }

    if (existingHold[0].status !== 'active') {
      return NextResponse.json(
        { error: 'Only active holds can be cancelled' },
        { status: 400 }
      );
    }

    await db
      .update(holds)
      .set({
        status: 'cancelled',
      })
      .where(eq(holds.id, id));

    // Log audit event
    await logAuditEvent({
      entityType: 'hold',
      entityId: id,
      action: 'delete',
      details: { 
        previousStatus: existingHold[0].status,
        amount: existingHold[0].amount,
        type: existingHold[0].type,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling hold:', error);
    return NextResponse.json(
      { error: 'Failed to cancel hold' },
      { status: 500 }
    );
  }
}
