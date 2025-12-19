import { NextRequest, NextResponse } from 'next/server';
import { db, holds, matters } from '@/db';
import { eq } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';
import { getCaseDevService, CaseDevApiException } from '@/lib/casedev';

// POST /api/holds/[id]/release - Release a hold (full or partial)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { releaseReason, releasedBy, releaseAmount } = body;

    if (!releaseReason) {
      return NextResponse.json(
        { error: 'Release reason is required' },
        { status: 400 }
      );
    }

    const existingHold = await db
      .select({
        id: holds.id,
        matterId: holds.matterId,
        amount: holds.amount,
        type: holds.type,
        description: holds.description,
        status: holds.status,
        casedevHoldId: holds.casedevHoldId,
        matterName: matters.name,
      })
      .from(holds)
      .leftJoin(matters, eq(holds.matterId, matters.id))
      .where(eq(holds.id, params.id))
      .limit(1);

    if (existingHold.length === 0) {
      return NextResponse.json(
        { error: 'Hold not found' },
        { status: 404 }
      );
    }

    if (existingHold[0].status !== 'active') {
      return NextResponse.json(
        { error: 'Only active holds can be released' },
        { status: 400 }
      );
    }

    // Determine release amount (default to full hold amount)
    const amountToRelease = releaseAmount ? Math.round(releaseAmount) : existingHold[0].amount;
    const isPartialRelease = amountToRelease < existingHold[0].amount;
    
    if (amountToRelease <= 0) {
      return NextResponse.json(
        { error: 'Release amount must be greater than 0' },
        { status: 400 }
      );
    }
    
    if (amountToRelease > existingHold[0].amount) {
      return NextResponse.json(
        { error: `Release amount cannot exceed hold amount (${existingHold[0].amount / 100})` },
        { status: 400 }
      );
    }

    const now = new Date();
    
    // Release hold in Case.dev if synced
    let casedevReleased = false;
    if (existingHold[0].casedevHoldId) {
      const casedevService = await getCaseDevService();
      if (casedevService?.isConfigured()) {
        try {
          await casedevService.releaseHold(
            existingHold[0].casedevHoldId,
            releaseReason
          );
          casedevReleased = true;
          console.log(`Released Case.dev hold: ${existingHold[0].casedevHoldId}`);
        } catch (error) {
          if (error instanceof CaseDevApiException) {
            console.error('Failed to release hold in Case.dev:', error);
            // Continue with local release
          } else {
            throw error;
          }
        }
      }
    }

    let updatedHold;
    
    if (isPartialRelease) {
      // For partial release, reduce the hold amount instead of releasing completely
      const remainingAmount = existingHold[0].amount - amountToRelease;
      updatedHold = await db
        .update(holds)
        .set({
          amount: remainingAmount,
          releaseReason: `Partial release of ${amountToRelease / 100}: ${releaseReason}`,
        })
        .where(eq(holds.id, params.id))
        .returning();
    } else {
      // Full release
      updatedHold = await db
        .update(holds)
        .set({
          status: 'released',
          releasedAt: now,
          releasedBy: releasedBy || null,
          releaseReason,
        })
        .where(eq(holds.id, params.id))
        .returning();
    }

    // Log audit event
    await logAuditEvent({
      entityType: 'hold',
      entityId: params.id,
      action: isPartialRelease ? 'partial_release' : 'release',
      details: { 
        originalAmount: existingHold[0].amount,
        releasedAmount: amountToRelease,
        remainingAmount: isPartialRelease ? existingHold[0].amount - amountToRelease : 0,
        type: existingHold[0].type,
        releaseReason,
        releasedBy,
        matterName: existingHold[0].matterName,
        casedevHoldId: existingHold[0].casedevHoldId,
        casedevReleased,
        isPartialRelease,
      },
    });

    return NextResponse.json(updatedHold[0]);
  } catch (error) {
    console.error('Error releasing hold:', error);
    return NextResponse.json(
      { error: 'Failed to release hold' },
      { status: 500 }
    );
  }
}
