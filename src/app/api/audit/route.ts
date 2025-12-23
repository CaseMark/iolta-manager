import { NextRequest, NextResponse } from 'next/server';
import { db, auditLogs } from '@/db';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for query parameters
const auditQuerySchema = z.object({
  entityType: z.enum(['all', 'client', 'matter', 'transaction', 'hold', 'report', 'settings']).optional(),
  action: z.enum(['all', 'create', 'update', 'delete', 'view', 'export', 'release', 'partial_release']).optional(),
  search: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(200),
  offset: z.coerce.number().min(0).default(0),
});

// Helper to sanitize search input for SQL LIKE queries
function sanitizeSearchInput(input: string): string {
  // Escape SQL LIKE wildcards and limit length
  return input
    .replace(/[%_\\]/g, '\\$&')
    .substring(0, 200);
}

// GET /api/audit - Get audit logs with filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Validate query parameters
    const queryParams = {
      entityType: searchParams.get('entityType') || undefined,
      action: searchParams.get('action') || undefined,
      search: searchParams.get('search') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit') || '200',
      offset: searchParams.get('offset') || '0',
    };

    const validationResult = auditQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { entityType, action, search, startDate, endDate, limit, offset } = validationResult.data;

    // Build conditions array
    const conditions = [];

    if (entityType && entityType !== 'all') {
      conditions.push(eq(auditLogs.entityType, entityType));
    }

    if (action && action !== 'all') {
      conditions.push(eq(auditLogs.action, action));
    }

    if (search) {
      // Sanitize search input to prevent SQL injection
      const sanitizedSearch = sanitizeSearchInput(search);
      // Search in entityId, details, userEmail
      conditions.push(
        sql`(${auditLogs.entityId} LIKE ${'%' + sanitizedSearch + '%'} OR ${auditLogs.details} LIKE ${'%' + sanitizedSearch + '%'} OR ${auditLogs.userEmail} LIKE ${'%' + sanitizedSearch + '%'})`
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

// NOTE: DELETE endpoint removed for IOLTA compliance
// Audit logs are immutable records required for legal compliance.
// They should never be deleted. If data retention policies require
// archival, implement a separate archival process with proper controls.
