import { NextRequest, NextResponse } from 'next/server';
import { db, matters, transactions, holds } from '@/db';
import { eq, isNull } from 'drizzle-orm';
import { getCaseDevService } from '@/lib/casedev';
import { logAuditEvent } from '@/lib/audit';

/**
 * POST /api/casedev/sync - Sync local matters with Case.dev sub-accounts
 * 
 * This creates Case.dev sub-accounts for matters that don't have one yet.
 * Useful for migrating existing data or recovering from sync issues.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { matterId } = body;

    const service = await getCaseDevService();
    
    if (!service || !service.isConfigured()) {
      return NextResponse.json(
        { error: 'Case.dev integration not configured' },
        { status: 400 }
      );
    }

    // Get matters without Case.dev accounts
    let mattersToSync;
    if (matterId) {
      mattersToSync = await db
        .select()
        .from(matters)
        .where(eq(matters.id, matterId));
    } else {
      mattersToSync = await db
        .select()
        .from(matters)
        .where(isNull(matters.casedevAccountId));
    }

    if (mattersToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matters require syncing',
        synced: 0,
      });
    }

    const results: Array<{ matterId: string; matterNumber: string; success: boolean; casedevAccountId?: string; error?: string }> = [];

    for (const matter of mattersToSync) {
      try {
        // Get client info
        const client = await db.query.clients.findFirst({
          where: (clients, { eq }) => eq(clients.id, matter.clientId),
        });

        if (!client) {
          results.push({
            matterId: matter.id,
            matterNumber: matter.matterNumber || 'Unknown',
            success: false,
            error: 'Client not found',
          });
          continue;
        }

        // Create sub-account
        const subAccount = await service.createSubAccount({
          name: `${client.name} - ${matter.name}`,
          matterId: matter.id,
          clientId: matter.clientId,
          matterNumber: matter.matterNumber || undefined,
        });

        // Update matter with Case.dev account ID
        await db
          .update(matters)
          .set({ casedevAccountId: subAccount.id })
          .where(eq(matters.id, matter.id));

        // Log audit event
        await logAuditEvent({
          entityType: 'matter',
          entityId: matter.id,
          action: 'update',
          details: {
            action: 'casedev_sync',
            casedevAccountId: subAccount.id,
          },
        });

        results.push({
          matterId: matter.id,
          matterNumber: matter.matterNumber || 'Unknown',
          success: true,
          casedevAccountId: subAccount.id,
        });
      } catch (error) {
        results.push({
          matterId: matter.id,
          matterNumber: matter.matterNumber || 'Unknown',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failureCount === 0,
      message: `Synced ${successCount} matters${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      synced: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error('Error syncing with Case.dev:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync with Case.dev' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/casedev/sync - Get sync status
 */
export async function GET() {
  try {
    const service = await getCaseDevService();
    
    if (!service || !service.isConfigured()) {
      return NextResponse.json({
        configured: false,
        message: 'Case.dev integration not configured',
      });
    }

    // Count matters with and without Case.dev accounts
    const allMatters = await db.select().from(matters);
    const withAccount = allMatters.filter(m => m.casedevAccountId).length;
    const withoutAccount = allMatters.filter(m => !m.casedevAccountId).length;

    // Count transactions and holds with and without Case.dev IDs
    const allTransactions = await db.select().from(transactions);
    const txnsSynced = allTransactions.filter(t => t.casedevTransactionId).length;
    const txnsNotSynced = allTransactions.filter(t => !t.casedevTransactionId).length;

    const allHolds = await db.select().from(holds);
    const holdsSynced = allHolds.filter(h => h.casedevHoldId).length;
    const holdsNotSynced = allHolds.filter(h => !h.casedevHoldId).length;

    return NextResponse.json({
      configured: true,
      matters: {
        total: allMatters.length,
        synced: withAccount,
        notSynced: withoutAccount,
      },
      transactions: {
        total: allTransactions.length,
        synced: txnsSynced,
        notSynced: txnsNotSynced,
      },
      holds: {
        total: allHolds.length,
        synced: holdsSynced,
        notSynced: holdsNotSynced,
      },
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

