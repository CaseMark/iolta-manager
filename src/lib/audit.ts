import { db, auditLogs } from '@/db';
import { v4 as uuidv4 } from 'uuid';

export type EntityType = 'client' | 'matter' | 'transaction' | 'hold' | 'report' | 'settings';
export type AuditAction = 'create' | 'update' | 'delete' | 'view' | 'export' | 'release' | 'partial_release';

export interface AuditEventParams {
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  details?: Record<string, unknown>;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
}

/**
 * Log an audit event to the database
 * This function is used to track all create, update, delete, and other significant operations
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: uuidv4(),
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      details: params.details ? JSON.stringify(params.details) : null,
      userId: params.userId || null,
      userEmail: params.userEmail || null,
      ipAddress: params.ipAddress || null,
      timestamp: new Date(),
    });
  } catch (error) {
    // Log error but don't throw - audit logging should not break main operations
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Helper to extract changes between old and new objects for audit details
 */
export function getChanges(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fieldsToTrack: string[]
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  
  for (const field of fieldsToTrack) {
    if (oldObj[field] !== newObj[field]) {
      changes[field] = {
        from: oldObj[field],
        to: newObj[field],
      };
    }
  }
  
  return changes;
}
