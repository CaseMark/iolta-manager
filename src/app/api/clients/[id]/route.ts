import { NextRequest, NextResponse } from 'next/server';
import { db, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { logAuditEvent, getChanges } from '@/lib/audit';

// GET /api/clients/[id] - Get a single client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const client = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (client.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(client[0]);
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client' },
      { status: 500 }
    );
  }
}

// PUT /api/clients/[id] - Update a client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { name, email, phone, address, notes, status } = body;

    const existingClient = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (existingClient.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const updateData = {
      name: name ?? existingClient[0].name,
      email: email ?? existingClient[0].email,
      phone: phone ?? existingClient[0].phone,
      address: address ?? existingClient[0].address,
      notes: notes ?? existingClient[0].notes,
      status: status ?? existingClient[0].status,
      updatedAt: new Date(),
    };

    const updatedClient = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();

    // Log audit event with changes
    const changes = getChanges(
      existingClient[0] as Record<string, unknown>,
      updateData as Record<string, unknown>,
      ['name', 'email', 'phone', 'address', 'notes', 'status']
    );
    
    if (Object.keys(changes).length > 0) {
      await logAuditEvent({
        entityType: 'client',
        entityId: id,
        action: 'update',
        details: { changes },
      });
    }

    return NextResponse.json(updatedClient[0]);
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id] - Archive a client (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const existingClient = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (existingClient.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Soft delete by setting status to archived
    await db
      .update(clients)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id));

    // Log audit event
    await logAuditEvent({
      entityType: 'client',
      entityId: id,
      action: 'delete',
      details: { 
        clientName: existingClient[0].name,
        previousStatus: existingClient[0].status,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error archiving client:', error);
    return NextResponse.json(
      { error: 'Failed to archive client' },
      { status: 500 }
    );
  }
}
