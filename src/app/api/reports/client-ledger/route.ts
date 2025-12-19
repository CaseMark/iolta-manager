import { NextRequest, NextResponse } from 'next/server';
import { db, transactions, matters, clients, trustAccountSettings, holds } from '@/db';
import { eq, sql, and, gte, lte } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';
import { getIOLTAComplianceRules } from '@/lib/iolta-compliance';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Professional black/white HTML styles for PDF-ready reports
const professionalStyles = `
  * { box-sizing: border-box; }
  body { 
    font-family: Helvetica, Arial, sans-serif; 
    font-size: 11pt; 
    line-height: 1.4;
    margin: 0.75in; 
    color: #000; 
  }
  h1 { 
    font-size: 16pt; 
    font-weight: bold;
    border-bottom: 2px solid #000; 
    padding-bottom: 8px; 
    margin: 0 0 15px 0;
  }
  h2 { 
    font-size: 13pt; 
    font-weight: bold;
    margin: 25px 0 10px 0;
    border-bottom: 1px solid #000;
    padding-bottom: 4px;
  }
  .header { margin-bottom: 20px; }
  .firm-name { font-size: 14pt; font-weight: bold; margin-bottom: 3px; }
  .client-name { font-size: 12pt; margin-bottom: 10px; }
  .period { font-size: 10pt; margin: 2px 0; }
  .client-info { 
    border: 1px solid #000; 
    padding: 10px; 
    margin: 10px 0; 
  }
  .client-info p { margin: 3px 0; font-size: 10pt; }
  .summary-grid { 
    display: table;
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
  }
  .summary-row {
    display: table-row;
  }
  .summary-cell { 
    display: table-cell;
    border: 1px solid #000; 
    padding: 8px;
    width: 25%;
    vertical-align: top;
  }
  .summary-cell .label { 
    font-size: 9pt; 
    text-transform: uppercase; 
    font-weight: bold;
  }
  .summary-cell .value { 
    font-size: 14pt; 
    font-weight: bold; 
    margin-top: 3px; 
  }
  table { 
    width: 100%; 
    border-collapse: collapse; 
    margin-top: 10px; 
    font-size: 10pt; 
  }
  th { 
    background: #f0f0f0; 
    text-align: left; 
    padding: 6px 8px; 
    border: 1px solid #000; 
    font-weight: bold;
  }
  td { 
    padding: 5px 8px; 
    border: 1px solid #000; 
    vertical-align: top;
  }
  .amount { text-align: right; font-family: 'Courier New', monospace; }
  .balance { font-weight: bold; }
  .total-row { background: #f0f0f0; font-weight: bold; }
  .footer { 
    margin-top: 30px; 
    padding-top: 15px; 
    border-top: 1px solid #000; 
    font-size: 9pt; 
  }
  .footer p { margin: 2px 0; }
  .no-data { 
    border: 1px solid #000; 
    padding: 30px; 
    text-align: center; 
    margin: 30px 0; 
  }
  .small { font-size: 9pt; }
  @media print { 
    body { margin: 0.5in; }
    @page { margin: 0.5in; }
  }
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate, clientId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get firm settings
    const settingsResult = await db
      .select()
      .from(trustAccountSettings)
      .limit(1);

    const firmName = settingsResult[0]?.firmName || 'Law Firm';
    const state = settingsResult[0]?.state || '';

    // Get client info
    const clientResult = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (clientResult.length === 0) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const client = clientResult[0];

    // Get all matters for this client
    const clientMatters = await db
      .select()
      .from(matters)
      .where(eq(matters.clientId, clientId));

    const matterIds = clientMatters.map(m => m.id);

    if (matterIds.length === 0) {
      // No matters, generate empty report
      const html = generateEmptyClientReport(client, firmName, state, start, end);
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="client-ledger-${client.name.replace(/\s+/g, '-')}-${startDate}-to-${endDate}.html"`,
        },
      });
    }

    // Get opening balance for this client (all transactions before start date)
    const openingBalanceResult = await db
      .select({
        deposits: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN ${transactions.amount} ELSE 0 END), 0)`,
        disbursements: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'disbursement' THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .innerJoin(matters, eq(transactions.matterId, matters.id))
      .where(and(
        eq(matters.clientId, clientId),
        lte(transactions.createdAt, start)
      ));

    const openingBalance = (openingBalanceResult[0]?.deposits || 0) - (openingBalanceResult[0]?.disbursements || 0);

    // Get transactions in date range for this client
    const periodTransactions = await db
      .select({
        id: transactions.id,
        matterId: transactions.matterId,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        payee: transactions.payee,
        payor: transactions.payor,
        checkNumber: transactions.checkNumber,
        createdAt: transactions.createdAt,
        matterName: matters.name,
        matterNumber: matters.matterNumber,
      })
      .from(transactions)
      .innerJoin(matters, eq(transactions.matterId, matters.id))
      .where(and(
        eq(matters.clientId, clientId),
        gte(transactions.createdAt, start),
        lte(transactions.createdAt, end)
      ))
      .orderBy(transactions.createdAt);

    // Calculate period totals
    const periodDeposits = periodTransactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const periodDisbursements = periodTransactions
      .filter(t => t.type === 'disbursement')
      .reduce((sum, t) => sum + t.amount, 0);

    const closingBalance = openingBalance + periodDeposits - periodDisbursements;

    // Calculate running balance
    let runningBalance = openingBalance;
    const transactionsWithBalance = periodTransactions.map((txn) => {
      if (txn.type === 'deposit') {
        runningBalance += txn.amount;
      } else {
        runningBalance -= txn.amount;
      }
      return { ...txn, runningBalance };
    });

    // Get matter-by-matter breakdown
    const matterBreakdown = await db
      .select({
        matterId: matters.id,
        matterName: matters.name,
        matterNumber: matters.matterNumber,
        status: matters.status,
        deposits: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN ${transactions.amount} ELSE 0 END), 0)`,
        disbursements: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'disbursement' THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(matters)
      .leftJoin(transactions, eq(transactions.matterId, matters.id))
      .where(eq(matters.clientId, clientId))
      .groupBy(matters.id, matters.name, matters.matterNumber, matters.status);

    // Get active holds per matter
    const activeHolds = await db
      .select({
        matterId: holds.matterId,
        totalHolds: sql<number>`COALESCE(SUM(${holds.amount}), 0)`,
      })
      .from(holds)
      .innerJoin(matters, eq(holds.matterId, matters.id))
      .where(and(
        eq(matters.clientId, clientId),
        eq(holds.status, 'active')
      ))
      .groupBy(holds.matterId);

    const holdsMap = new Map(activeHolds.map(h => [h.matterId, h.totalHolds]));

    const matterSummaries = matterBreakdown.map(m => ({
      ...m,
      balance: (m.deposits || 0) - (m.disbursements || 0),
      activeHolds: holdsMap.get(m.matterId) || 0,
      availableBalance: ((m.deposits || 0) - (m.disbursements || 0)) - (holdsMap.get(m.matterId) || 0),
    }));

    const totalHolds = matterSummaries.reduce((sum, m) => sum + m.activeHolds, 0);

    // Get state-specific compliance rules
    const complianceRules = getIOLTAComplianceRules(state);

    // Log audit event
    await logAuditEvent({
      entityType: 'report',
      entityId: `client-ledger-${clientId}-${startDate}-${endDate}`,
      action: 'create',
      details: {
        reportType: 'client-ledger',
        clientId,
        clientName: client.name,
        startDate,
        endDate,
        transactionCount: periodTransactions.length,
        openingBalance,
        closingBalance,
        jurisdiction: complianceRules.state,
      },
    });

    // Generate professional HTML report
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Client Ledger Report - ${client.name}</title>
  <style>${professionalStyles}</style>
</head>
<body>
  <div class="header">
    <div class="firm-name">${firmName}</div>
    <div class="client-name">Client: ${client.name}</div>
    <h1>Client Trust Account Ledger</h1>
    <div class="client-info">
      ${client.email ? `<p><strong>Email:</strong> ${client.email}</p>` : ''}
      ${client.phone ? `<p><strong>Phone:</strong> ${client.phone}</p>` : ''}
      ${client.address ? `<p><strong>Address:</strong> ${client.address}</p>` : ''}
      <p><strong>Active Matters:</strong> ${matterSummaries.filter(m => m.status === 'open').length}</p>
    </div>
    <p class="period">Report Period: ${formatDate(start)} - ${formatDate(end)}</p>
    <p class="period">Generated: ${formatDate(new Date())}</p>
  </div>

  <div class="summary-grid">
    <div class="summary-row">
      <div class="summary-cell">
        <div class="label">Opening Balance</div>
        <div class="value">${formatCurrency(openingBalance)}</div>
      </div>
      <div class="summary-cell">
        <div class="label">Total Deposits</div>
        <div class="value">+${formatCurrency(periodDeposits)}</div>
      </div>
      <div class="summary-cell">
        <div class="label">Total Disbursements</div>
        <div class="value">-${formatCurrency(periodDisbursements)}</div>
      </div>
      <div class="summary-cell">
        <div class="label">Closing Balance</div>
        <div class="value">${formatCurrency(closingBalance)}</div>
      </div>
    </div>
  </div>

  ${totalHolds > 0 ? `
  <div class="summary-grid">
    <div class="summary-row">
      <div class="summary-cell" style="width: 50%;">
        <div class="label">Active Holds</div>
        <div class="value">${formatCurrency(totalHolds)}</div>
      </div>
      <div class="summary-cell" style="width: 50%;">
        <div class="label">Available Balance</div>
        <div class="value">${formatCurrency(closingBalance - totalHolds)}</div>
      </div>
    </div>
  </div>
  ` : ''}

  <h2>Matter Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Matter</th>
        <th>Matter #</th>
        <th>Status</th>
        <th class="amount">Balance</th>
        <th class="amount">Holds</th>
        <th class="amount">Available</th>
      </tr>
    </thead>
    <tbody>
      ${matterSummaries.map(m => `
      <tr>
        <td>${m.matterName}</td>
        <td>${m.matterNumber || '-'}</td>
        <td>${m.status}</td>
        <td class="amount balance">${formatCurrency(m.balance)}</td>
        <td class="amount">${m.activeHolds > 0 ? formatCurrency(m.activeHolds) : '-'}</td>
        <td class="amount">${formatCurrency(m.availableBalance)}</td>
      </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3"><strong>Total Client Funds</strong></td>
        <td class="amount balance"><strong>${formatCurrency(closingBalance)}</strong></td>
        <td class="amount"><strong>${totalHolds > 0 ? formatCurrency(totalHolds) : '-'}</strong></td>
        <td class="amount"><strong>${formatCurrency(closingBalance - totalHolds)}</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>Transaction Detail</h2>
  ${transactionsWithBalance.length === 0 ? '<p>No transactions in this period.</p>' : `
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Matter</th>
        <th>Description</th>
        <th>Reference</th>
        <th class="amount">Debit</th>
        <th class="amount">Credit</th>
        <th class="amount">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="6"><strong>Opening Balance</strong></td>
        <td class="amount balance">${formatCurrency(openingBalance)}</td>
      </tr>
      ${transactionsWithBalance.map(txn => `
      <tr>
        <td>${formatDate(txn.createdAt)}</td>
        <td>${txn.matterName}${txn.matterNumber ? `<br><span class="small">#${txn.matterNumber}</span>` : ''}</td>
        <td>${txn.description}${txn.payor ? `<br><span class="small">From: ${txn.payor}</span>` : ''}${txn.payee ? `<br><span class="small">To: ${txn.payee}</span>` : ''}</td>
        <td>${txn.checkNumber || '-'}</td>
        <td class="amount">${txn.type === 'disbursement' ? formatCurrency(txn.amount) : ''}</td>
        <td class="amount">${txn.type === 'deposit' ? formatCurrency(txn.amount) : ''}</td>
        <td class="amount balance">${formatCurrency(txn.runningBalance)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  `}

  <h2>Compliance Note</h2>
  <div style="border: 1px solid #000; padding: 15px; margin: 15px 0; font-size: 9pt;">
    <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
      <tr>
        <td style="padding: 4px 8px; border: 1px solid #ccc; width: 35%;"><strong>Jurisdiction:</strong></td>
        <td style="padding: 4px 8px; border: 1px solid #ccc;">${complianceRules.state} - ${complianceRules.barAssociation}</td>
      </tr>
      <tr>
        <td style="padding: 4px 8px; border: 1px solid #ccc;"><strong>Record Retention:</strong></td>
        <td style="padding: 4px 8px; border: 1px solid #ccc;">${complianceRules.recordRetentionYears} years</td>
      </tr>
      <tr>
        <td style="padding: 4px 8px; border: 1px solid #ccc;"><strong>Reconciliation:</strong></td>
        <td style="padding: 4px 8px; border: 1px solid #ccc;">${complianceRules.reconciliationFrequency.charAt(0).toUpperCase() + complianceRules.reconciliationFrequency.slice(1)} (within ${complianceRules.reconciliationDeadlineDays} days)</td>
      </tr>
      <tr>
        <td style="padding: 4px 8px; border: 1px solid #ccc;"><strong>Three-Way Reconciliation:</strong></td>
        <td style="padding: 4px 8px; border: 1px solid #ccc;">${complianceRules.threeWayReconciliationRequired ? 'Required' : 'Recommended'}</td>
      </tr>
      <tr>
        <td style="padding: 4px 8px; border: 1px solid #ccc;"><strong>Citation:</strong></td>
        <td style="padding: 4px 8px; border: 1px solid #ccc;">${complianceRules.rulesCitation}</td>
      </tr>
    </table>
    <p style="margin-top: 10px; font-style: italic;">
      Note: This report is for informational purposes. Always consult the current rules from ${complianceRules.barAssociation} for the most up-to-date requirements.
    </p>
  </div>

  <div class="footer">
    <p><strong>Client Trust Account Ledger</strong> - ${client.name}</p>
    <p>${firmName}${state ? ` | ${complianceRules.state}` : ''}</p>
    <p>Report ID: client-ledger-${clientId}-${startDate}-${endDate}</p>
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="client-ledger-${client.name.replace(/\s+/g, '-')}-${startDate}-to-${endDate}.html"`,
      },
    });
  } catch (error) {
    console.error('Error generating client ledger report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

function generateEmptyClientReport(
  client: { name: string; email: string | null; phone: string | null; address: string | null },
  firmName: string,
  state: string,
  start: Date,
  end: Date
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Client Ledger Report - ${client.name}</title>
  <style>${professionalStyles}</style>
</head>
<body>
  <div class="header">
    <div class="firm-name">${firmName}</div>
    <div class="client-name">Client: ${client.name}</div>
    <h1>Client Trust Account Ledger</h1>
    <p class="period">Report Period: ${formatDate(start)} - ${formatDate(end)}</p>
    <p class="period">Generated: ${formatDate(new Date())}</p>
  </div>

  <div class="no-data">
    <p>No matters or transactions found for this client.</p>
  </div>

  <div class="footer">
    <p><strong>Client Trust Account Ledger</strong> - ${client.name}</p>
    <p>${firmName}${state ? ` | ${state}` : ''}</p>
  </div>
</body>
</html>
  `;
}
