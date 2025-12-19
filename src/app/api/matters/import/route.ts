import { NextRequest, NextResponse } from 'next/server';

// Define the expected structure for extracted matter data
interface ExtractedMatterData {
  matter: {
    name: string;
    matterNumber?: string;
    matterType?: string;
    description?: string;
    status?: string;
    openDate?: string;
    responsibleAttorney?: string;
    practiceArea?: string;
    court?: string;
    courtCaseNumber?: string;
    opposingParty?: string;
    opposingCounsel?: string;
  };
  client: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  financialSummary?: {
    trustBalance?: number;
    totalDeposits?: number;
    totalDisbursements?: number;
    activeHolds?: number;
    availableBalance?: number;
  };
  transactions: Array<{
    id?: string;
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
    balanceAfter?: number;
  }>;
  holds: Array<{
    id?: string;
    type: string;
    amount: number;
    description: string;
    status: 'active' | 'released';
    createdDate?: string;
    expectedReleaseDate?: string;
    releaseConditions?: string;
    notes?: string;
  }>;
}

// POST /api/matters/import - Extract matter data from uploaded document using AI
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'txt', 'docx', 'doc'];
    
    if (!allowedExtensions.includes(fileExtension || '')) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported formats: PDF, TXT, DOCX' },
        { status: 400 }
      );
    }

    // Read file content
    let textContent: string;
    
    if (fileExtension === 'txt') {
      // For text files, read directly
      textContent = await file.text();
    } else if (fileExtension === 'pdf' || fileExtension === 'docx' || fileExtension === 'doc') {
      // For PDF and DOCX, we need to use Case.dev OCR or extract text
      // First, try to use Case.dev OCR API if available
      const apiKey = process.env.CASEDEV_API_KEY;
      
      if (apiKey) {
        // Upload to Case.dev for OCR processing
        const ocrResult = await processWithCasedevOCR(file, apiKey);
        if (ocrResult.success) {
          textContent = ocrResult.text;
        } else {
          // Fallback: try to read as text (works for some PDFs)
          textContent = await file.text();
        }
      } else {
        // No API key, try to read as text
        textContent = await file.text();
      }
    } else {
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

    const extractedData = await extractMatterDataWithAI(textContent, apiKey);

    return NextResponse.json({
      success: true,
      data: extractedData,
      sourceFile: file.name,
      textLength: textContent.length,
    });

  } catch (error) {
    console.error('Error processing matter import:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process document' },
      { status: 500 }
    );
  }
}

// Process document with Case.dev OCR
async function processWithCasedevOCR(file: File, apiKey: string): Promise<{ success: boolean; text: string }> {
  try {
    // Convert file to base64 for upload
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // For now, we'll use a simpler approach - upload the file and use the LLM directly
    // The LLM can handle document content extraction
    // In production, you would use the full OCR pipeline
    
    return { success: false, text: '' };
  } catch (error) {
    console.error('OCR processing error:', error);
    return { success: false, text: '' };
  }
}

// Extract matter data using Case.dev LLM
async function extractMatterDataWithAI(documentText: string, apiKey: string): Promise<ExtractedMatterData> {
  const systemPrompt = `You are a legal document parser specializing in IOLTA trust account records. 
Your task is to extract structured data from matter/transaction history documents.

Extract the following information and return it as valid JSON:

1. Matter Details:
   - name (required): The matter name (e.g., "Smith v. Jones")
   - matterNumber: Matter ID or number
   - matterType: Type of matter (e.g., "Commercial Litigation")
   - description: Brief description
   - status: Current status (open, closed, pending)
   - openDate: When the matter was opened (ISO date format YYYY-MM-DD)
   - responsibleAttorney: Attorney name
   - practiceArea: Practice area category
   - court: Court name if applicable
   - courtCaseNumber: Court case number
   - opposingParty: Opposing party name
   - opposingCounsel: Opposing counsel name/firm

2. Client Information:
   - name (required): Client name
   - email: Client email
   - phone: Client phone
   - address: Client address

3. Financial Summary (if available):
   - trustBalance: Current trust balance in dollars
   - totalDeposits: Total deposits in dollars
   - totalDisbursements: Total disbursements in dollars
   - activeHolds: Total active holds in dollars
   - availableBalance: Available balance in dollars

4. Transactions (array):
   - date (required): Transaction date (ISO format YYYY-MM-DD)
   - type (required): "deposit" or "disbursement"
   - category: Transaction category
   - description (required): Transaction description
   - amount (required): Amount in dollars (as number, not string)
   - payee: For disbursements, who was paid
   - payor: For deposits, who paid
   - checkNumber: Check number if applicable
   - reference: Reference number
   - paymentMethod: Payment method (wire, check, etc.)
   - balanceAfter: Balance after transaction

5. Holds (array):
   - type (required): Hold type (retainer, settlement, escrow, compliance)
   - amount (required): Hold amount in dollars
   - description (required): Hold description
   - status (required): "active" or "released"
   - createdDate: When hold was created
   - expectedReleaseDate: Expected release date
   - releaseConditions: Conditions for release
   - notes: Additional notes

Return ONLY valid JSON with this structure:
{
  "matter": { ... },
  "client": { ... },
  "financialSummary": { ... },
  "transactions": [ ... ],
  "holds": [ ... ]
}

Important:
- All amounts should be numbers (not strings)
- Dates should be in YYYY-MM-DD format
- If information is not found, omit the field or use null
- Extract ALL transactions and holds found in the document
- Infer the client name from the matter name if not explicitly stated (e.g., "Johnson Manufacturing" from "JOHNSON MANUFACTURING - SMITH V. JOHNSON LITIGATION")`;

  const userPrompt = `Please extract the matter, client, transactions, and holds data from this document:

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
        temperature: 0, // Use 0 for deterministic extraction
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
    // The AI might wrap the JSON in markdown code blocks, so we need to extract it
    let jsonString = content;
    
    // Remove markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
    }

    // Try to parse the JSON
    const extractedData = JSON.parse(jsonString.trim()) as ExtractedMatterData;

    // Validate required fields
    if (!extractedData.matter?.name) {
      throw new Error('Could not extract matter name from document');
    }

    if (!extractedData.client?.name) {
      // Try to infer client name from matter name
      const matterName = extractedData.matter.name;
      const clientMatch = matterName.match(/^([^-]+)/);
      if (clientMatch) {
        extractedData.client = {
          ...extractedData.client,
          name: clientMatch[1].trim(),
        };
      } else {
        extractedData.client = {
          name: 'Unknown Client',
        };
      }
    }

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
