import { NextRequest, NextResponse } from 'next/server';
import { db, clients } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import { desc } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';
import { z } from 'zod';

// Validation schema for creating a client
const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(255),
  email: z.string().email('Invalid email format').max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// GET /api/clients - List all clients
export async function GET() {
  try {
    const allClients = await db
      .select()
      .from(clients)
      .orderBy(desc(clients.createdAt));
    
    return NextResponse.json(allClients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = createClientSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { name, email, phone, address, notes } = validationResult.data;

    const now = new Date();
    const newClient = {
      id: uuidv4(),
      name,
      email: email || null,
      phone: phone || null,
      address: address || null,
      notes: notes || null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(clients).values(newClient);

    // Log audit event
    await logAuditEvent({
      entityType: 'client',
      entityId: newClient.id,
      action: 'create',
      details: { name, email, phone, address },
    });

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}
