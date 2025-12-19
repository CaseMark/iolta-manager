import { NextRequest, NextResponse } from 'next/server';
import { db, auditLogs } from '@/db';
import { desc, eq, and, like, gte, lte, inArray, sql } from 'drizzle-orm';

// GET /api/audit - Get audit logs with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const action = searchParams.get('action');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build conditions array
    const conditions = [];

    if (entityType && entityType !== 'all') {
      conditions.push(eq(auditLogs.entityType, entityType));
    }

    if (action && action !== 'all') {
      conditions.push(eq(auditLogs.action, action));
    }

    if (search) {
      // Search in entityId, details, userEmail
      conditions.push(
        sql`(${auditLogs.entityId} LIKE ${'%' + search + '%'} OR ${auditLogs.details} LIKE ${'%' + search + '%'} OR ${auditLogs.userEmail} LIKE ${'%' + search + '%'})`
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      conditions.push(gte(auditLogs.timestamp, start));
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.timestamp, end));
    }

    // Get total count for pagination
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;

    // Get filtered logs
    const logs = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit)
      .offset(offset);

    // Get stats
    const stats = {
      total,
      creates: logs.filter(l => l.action === 'create').length,
      updates: logs.filter(l => l.action === 'update').length,
      deletes: logs.filter(l => l.action === 'delete').length,
    };

    return NextResponse.json({
      logs,
      stats,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}

// DELETE /api/audit - Delete audit logs (single or bulk)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, deleteAll, beforeDate } = body;

    if (deleteAll) {
      // Delete all audit logs (dangerous - should require confirmation)
      await db.delete(auditLogs);
      return NextResponse.json({ message: 'All audit logs deleted', count: 'all' });
    }

    if (beforeDate) {
      // Delete logs before a certain date
      const date = new Date(beforeDate);
      const result = await db
        .delete(auditLogs)
        .where(lte(auditLogs.timestamp, date));
      
      return NextResponse.json({ message: 'Audit logs deleted', beforeDate });
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete specific logs by ID
      await db
        .delete(auditLogs)
        .where(inArray(auditLogs.id, ids));
      
      return NextResponse.json({ message: 'Audit logs deleted', count: ids.length });
    }

    return NextResponse.json(
      { error: 'No deletion criteria provided' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to delete audit logs' },
      { status: 500 }
    );
  }
}
