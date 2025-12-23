import { NextRequest, NextResponse } from 'next/server';
import { db, trustAccountSettings } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { logAuditEvent, getChanges } from '@/lib/audit';
import { z } from 'zod';

// Validation schema for settings
const settingsSchema = z.object({
  firmName: z.string().max(255).optional().nullable(),
  firmLogo: z.string().max(1000000).optional().nullable(), // ~750KB base64
  bankName: z.string().max(255).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  routingNumber: z.string().max(20).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
});

// Helper to mask sensitive data
function maskSensitiveData(value: string | null): string | null {
  if (!value || value.length < 4) return value;
  return '••••' + value.slice(-4);
}

// GET /api/settings - Get current settings (with masked sensitive data)
export async function GET() {
  try {
    const settings = await db.select().from(trustAccountSettings).limit(1);
    
    if (settings.length === 0) {
      return NextResponse.json(null);
    }

    // Mask sensitive financial data before returning
    const maskedSettings = {
      ...settings[0],
      accountNumber: maskSensitiveData(settings[0].accountNumber),
      routingNumber: maskSensitiveData(settings[0].routingNumber),
    };

    return NextResponse.json(maskedSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update settings (upsert)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = settingsSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { 
      firmName, 
      firmLogo,
      bankName, 
      accountNumber, 
      routingNumber, 
      state,
    } = validationResult.data;

    const now = new Date();

    // Check if settings exist
    const existingSettings = await db.select().from(trustAccountSettings).limit(1);

    if (existingSettings.length === 0) {
      // Create new settings
      const newSettings = {
        id: uuidv4(),
        firmName: firmName || null,
        firmLogo: firmLogo || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        routingNumber: routingNumber || null,
        state: state || null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(trustAccountSettings).values(newSettings);

      // Log audit event
      await logAuditEvent({
        entityType: 'settings',
        entityId: newSettings.id,
        action: 'create',
        details: { 
          firmName,
          bankName,
          state,
          hasLogo: !!firmLogo,
        },
      });

      return NextResponse.json(newSettings, { status: 201 });
    } else {
      // Update existing settings - handle firmLogo specially (can be set to empty string to remove)
      const updateData: Record<string, unknown> = {
        firmName: firmName ?? existingSettings[0].firmName,
        bankName: bankName ?? existingSettings[0].bankName,
        state: state ?? existingSettings[0].state,
        updatedAt: now,
      };

      // Handle firmLogo - allow explicit empty string to remove logo
      if (firmLogo !== undefined) {
        updateData.firmLogo = firmLogo || null;
      } else {
        updateData.firmLogo = existingSettings[0].firmLogo;
      }

      // Only update account/routing if explicitly provided (not masked values)
      if (accountNumber !== undefined) {
        updateData.accountNumber = accountNumber || null;
      } else {
        updateData.accountNumber = existingSettings[0].accountNumber;
      }
      
      if (routingNumber !== undefined) {
        updateData.routingNumber = routingNumber || null;
      } else {
        updateData.routingNumber = existingSettings[0].routingNumber;
      }

      const updatedSettings = await db
        .update(trustAccountSettings)
        .set(updateData)
        .where(eq(trustAccountSettings.id, existingSettings[0].id))
        .returning();

      // Log audit event with changes (exclude logo content from audit)
      const changesForAudit = getChanges(
        existingSettings[0] as Record<string, unknown>,
        { ...updateData, firmLogo: updateData.firmLogo ? '[logo data]' : null },
        ['firmName', 'bankName', 'state']
      );
      
      // Check if logo changed
      const logoChanged = (existingSettings[0].firmLogo ? true : false) !== (updateData.firmLogo ? true : false);
      if (logoChanged) {
        changesForAudit['firmLogo'] = { 
          from: existingSettings[0].firmLogo ? '[had logo]' : '[no logo]', 
          to: updateData.firmLogo ? '[has logo]' : '[no logo]' 
        };
      }
      
      if (Object.keys(changesForAudit).length > 0) {
        await logAuditEvent({
          entityType: 'settings',
          entityId: existingSettings[0].id,
          action: 'update',
          details: { changes: changesForAudit },
        });
      }

      return NextResponse.json(updatedSettings[0]);
    }
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
