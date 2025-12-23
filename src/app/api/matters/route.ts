import { NextRequest, NextResponse } from 'next/server';
import { db, matters, clients, transactions } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import { desc, eq, sql } from 'drizzle-orm';
import { generateMatterNumber } from '@/lib/utils';
import { logAuditEvent } from '@/lib/audit';
import { getCaseDevService } from '@/lib/casedev';
import { z } from 'zod';

// Validation schema for creating a new client inline
const newClientSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// Validation schema for creating a matter
const createMatterSchema = z.object({
  clientId: z.string().uuid('Invalid client ID').optional(),
  name: z.string().min(1, 'Matter name is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  practiceArea: z.string().max(100).optional().nullable(),
  responsibleAttorney: z.string().max(255).optional().nullable(),
  newClient: newClientSchema.optional(),
}).refine(
  (data) => data.clientId || data.newClient,
  { message: 'Either clientId or newClient must be provided' }
);

// GET /api/matters - List all matters with client info and balances
export async function GET() {
  try {
    const allMatters = await db
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
      })
      .from(matters)
      .leftJoin(clients, eq(matters.clientId, clients.id))
      .orderBy(desc(matters.createdAt));

    // Get balances for each matter
    const mattersWithBalances = await Promise.all(
      allMatters.map(async (matter) => {
        const balanceResult = await db
          .select({
            deposits: sql<number>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)`,
            disbursements: sql<number>`COALESCE(SUM(CASE WHEN type = 'disbursement' THEN amount ELSE 0 END), 0)`,
          })
          .from(transactions)
          .where(eq(transactions.matterId, matter.id));

        const deposits = balanceResult[0]?.deposits || 0;
        const disbursements = balanceResult[0]?.disbursements || 0;
        const balance = deposits - disbursements;

        return {
          ...matter,
          balance,
        };
      })
    );

    return NextResponse.json(mattersWithBalances);
  } catch (error) {
    console.error('Error fetching matters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matters' },
      { status: 500 }
    );
  }
}

// POST /api/matters - Create a new matter
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = createMatterSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { 
      clientId, 
      name, 
      description, 
      practiceArea, 
      responsibleAttorney,
      newClient 
    } = validationResult.data;

    let finalClientId: string = clientId || '';

    // If newClient data is provided, create the client first
    if (newClient && !clientId) {
      const now = new Date();
      const newClientRecord = {
        id: uuidv4(),
        name: newClient.name,
        email: newClient.email || null,
        phone: newClient.phone || null,
        address: newClient.address || null,
        notes: newClient.notes || null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(clients).values(newClientRecord);
      finalClientId = newClientRecord.id;
    }

    // Ensure we have a client ID (validation should have caught this, but double-check)
    if (!finalClientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, finalClientId))
      .limit(1);

    if (client.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const matterId = uuidv4();
    const matterNumber = generateMatterNumber();
    
    // Attempt to create Case.dev sub-account for trust accounting
    let casedevAccountId: string | null = null;
    try {
      const casedevService = await getCaseDevService();
      if (casedevService && casedevService.isConfigured()) {
        const subAccount = await casedevService.createSubAccount({
          name: `${client[0].name} - ${name}`,
          matterId,
          clientId: finalClientId,
          matterNumber,
        });
        casedevAccountId = subAccount.id;
        console.log(`Created Case.dev sub-account: ${subAccount.id} for matter ${matterNumber}`);
      }
    } catch (error) {
      // Log but don't fail matter creation if Case.dev is unavailable
      console.error('Failed to create Case.dev sub-account:', error);
    }

    const newMatter = {
      id: matterId,
      clientId: finalClientId,
      name,
      matterNumber,
      description: description || null,
      status: 'open',
      practiceArea: practiceArea || null,
      responsibleAttorney: responsibleAttorney || null,
      openDate: now,
      closeDate: null,
      casedevAccountId,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(matters).values(newMatter);

    // Log audit event for matter creation
    await logAuditEvent({
      entityType: 'matter',
      entityId: newMatter.id,
      action: 'create',
      details: { 
        name, 
        matterNumber: newMatter.matterNumber,
        clientId: finalClientId,
        clientName: client[0].name,
        practiceArea,
        responsibleAttorney,
        casedevAccountId,
      },
    });

    // If a new client was created, log that too
    if (newClient && !clientId) {
      await logAuditEvent({
        entityType: 'client',
        entityId: finalClientId,
        action: 'create',
        details: { 
          name: newClient.name, 
          email: newClient.email,
          createdWithMatter: newMatter.id,
        },
      });
    }

    return NextResponse.json(newMatter, { status: 201 });
  } catch (error) {
    console.error('Error creating matter:', error);
    return NextResponse.json(
      { error: 'Failed to create matter' },
      { status: 500 }
    );
  }
}
