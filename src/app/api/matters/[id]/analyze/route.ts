import { NextRequest, NextResponse } from 'next/server';
import { db, matters, transactions, holds } from '@/db';
import { eq } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';

// Define the expected structure for extracted data from documents
interface ExtractedDocumentData {
  transactions: Array<{
    date: string;
    type: 'deposit' | 'disbursement';
    category?: string;
    description: string;
    amount: number;
    payee?: string;
    payor?: string;
    checkNumber?: string;
    reference?: string;
    paymentMethod?: string;
  }>;
  holds: Array<{
    type: string;
    amount: number;
    description: string;
    status: 'active' | 'released';
    createdDate?: string;
    expectedReleaseDate?: string;
    releaseConditions?: string;
    notes?: string;
  }>;
  summary?: {
    documentType?: string;
    dateRange?: string;
    totalDeposits?: number;
    totalDisbursements?: number;
    notes?: string;
  };
}

// POST /api/matters/[id]/analyze - Analyze document and extract transactions/holds for existing matter
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matterId = params.id;

    // Verify matter exists
    const matterResult = await db
      .select()
      .from(matters)
      .where(eq(matters.id, matterId))
      .limit(1);

    if (matterResult.length === 0) {
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    const matter = matterResult[0];

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Validate file type by extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'txt', 'docx', 'doc'];
    
    if (!allowedExtensions.includes(fileExtension || '')) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported formats: PDF, TXT, DOCX' },
        { status: 400 }
      );
    }

    // Validate MIME type
    const allowedMimeTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    
    if (file.type && !allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file MIME type: ${file.type}. Supported types: PDF, TXT, DOCX` },
        { status: 400 }
      );
    }

    // Read file content
    let textContent: string;
    
    if (fileExtension === 'txt') {
      textContent = await file.text();
    } else {
      // For PDF and DOCX, try to read as text
      // In production, you would use Case.dev OCR API
      textContent = await file.text();
    }

    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Could not extract text from the document. Please ensure the file contains readable text.' },
        { status: 400 }
      );
    }

    // Use Case.dev LLM to extract structured data
    const apiKey = process.env.CASEDEV_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Case.dev API key not configured. Please add CASEDEV_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    const extractedData = await extractDocumentDataWithAI(textContent, matter.name, apiKey);

    // Log audit event
    await logAuditEvent({
      entityType: 'matter',
      entityId: matterId,
      action: 'update',
      details: {
        action: 'document_analyzed',
        fileName: file.name,
        transactionsFound: extractedData.transactions.length,
        holdsFound: extractedData.holds.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: extractedData,
      sourceFile: file.name,
      matterId,
      matterName: matter.name,
    });

  } catch (error) {
    console.error('Error analyzing document:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze document' },
      { status: 500 }
    );
  }
}

// Extract transactions and holds from document using Case.dev LLM
async function extractDocumentDataWithAI(
  documentText: string, 
  matterName: string,
  apiKey: string
): Promise<ExtractedDocumentData> {
  const systemPrompt = `You are a legal document parser specializing in IOLTA trust account records.
Your task is to extract transactions and holds from documents related to an existing matter.

The matter name is: "${matterName}"

Extract the following information and return it as valid JSON:

1. Transactions (array):
   - date (required): Transaction date (ISO format YYYY-MM-DD)
   - type (required): "deposit" or "disbursement"
   - category: Transaction category (e.g., "Retainer", "Filing Fee", "Expert Witness", "Settlement")
   - description (required): Transaction description
   - amount (required): Amount in dollars (as number, not string)
   - payee: For disbursements, who was paid
   - payor: For deposits, who paid
   - checkNumber: Check number if applicable
   - reference: Reference number
   - paymentMethod: Payment method (wire, check, ACH, etc.)

2. Holds (array):
   - type (required): Hold type (retainer, settlement, escrow, compliance)
   - amount (required): Hold amount in dollars
   - description (required): Hold description
   - status (required): "active" or "released"
   - createdDate: When hold was created
   - expectedReleaseDate: Expected release date
   - releaseConditions: Conditions for release
   - notes: Additional notes

3. Summary (optional):
   - documentType: Type of document (invoice, statement, ledger, etc.)
   - dateRange: Date range covered by the document
   - totalDeposits: Sum of all deposits found
   - totalDisbursements: Sum of all disbursements found
   - notes: Any important notes or observations

Return ONLY valid JSON with this structure:
{
  "transactions": [ ... ],
  "holds": [ ... ],
  "summary": { ... }
}

Important:
- All amounts should be numbers (not strings)
- Dates should be in YYYY-MM-DD format
- If information is not found, omit the field or use null
- Extract ALL transactions and holds found in the document
- Be thorough - look for line items, invoices, payments, receipts, etc.
- For amounts, convert to dollars (e.g., "$1,500.00" becomes 1500)`;

  const userPrompt = `Please extract all transactions and holds from this document for the matter "${matterName}":

---
${documentText}
---

Return the extracted data as valid JSON.`;

  try {
    const response = await fetch('https://api.case.dev/llm/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Case.dev API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI model');
    }

    // Parse the JSON response
    let jsonString = content;
    
    // Remove markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
    }

    const extractedData = JSON.parse(jsonString.trim()) as ExtractedDocumentData;

    // Ensure arrays exist
    extractedData.transactions = extractedData.transactions || [];
    extractedData.holds = extractedData.holds || [];

    return extractedData;

  } catch (error) {
    console.error('AI extraction error:', error);
    
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse AI response as JSON. The document format may not be supported.');
    }
    
    throw error;
  }
}
