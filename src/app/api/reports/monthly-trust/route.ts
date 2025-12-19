import { NextRequest, NextResponse } from 'next/server';
import { db, transactions, matters, clients, trustAccountSettings, holds } from '@/db';
import { eq, sql, and, gte, lte } from 'drizzle-orm';
import { logAuditEvent } from '@/lib/audit';
import { getIOLTAComplianceRules, generateComplianceNoteHTML, IOLTAComplianceRules } from '@/lib/iolta-compliance';

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

// GET - Return JSON data for preview
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }

    const reportData = await generateReportData(startDate, endDate);
    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating report data:', error);
    return NextResponse.json({ error: 'Failed to generate report data' }, { status: 500 });
  }
}

// POST - Return PDF-ready HTML for download
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    const reportData = await generateReportData(startDate, endDate);

    // Log audit event for report generation
    await logAuditEvent({
      entityType: 'report',
      entityId: `monthly-trust-${startDate}-${endDate}`,
      action: 'create',
      details: {
        reportType: 'monthly-trust',
        startDate,
        endDate,
        transactionCount: reportData.transactions.length,
        openingBalance: reportData.openingBalance,
        closingBalance: reportData.closingBalance,
      },
    });

    // Generate professional black/white PDF-ready HTML
    const html = generateProfessionalHTML(reportData, startDate, endDate);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="monthly-trust-report-${startDate}-to-${endDate}.html"`,
      },
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

async function generateReportData(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Get firm settings
  const settingsResult = await db.select().from(trustAccountSettings).limit(1);
  const settings = settingsResult[0] || {};

  // Get opening balance
  const openingBalanceResult = await db
    .select({
      deposits: sql<number>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)`,
      disbursements: sql<number>`COALESCE(SUM(CASE WHEN type = 'disbursement' THEN amount ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(lte(transactions.createdAt, start));

  const openingBalance = (openingBalanceResult[0]?.deposits || 0) - (openingBalanceResult[0]?.disbursements || 0);

  // Get transactions in date range
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
      clientName: clients.name,
    })
    .from(transactions)
    .leftJoin(matters, eq(transactions.matterId, matters.id))
    .leftJoin(clients, eq(matters.clientId, clients.id))
    .where(and(gte(transactions.createdAt, start), lte(transactions.createdAt, end)))
    .orderBy(transactions.createdAt);

  const periodDeposits = periodTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
  const periodDisbursements = periodTransactions.filter(t => t.type === 'disbursement').reduce((sum, t) => sum + t.amount, 0);
  const closingBalance = openingBalance + periodDeposits - periodDisbursements;

  // Calculate running balance
  let runningBalance = openingBalance;
  const transactionsWithBalance = periodTransactions.map((txn) => {
    runningBalance += txn.type === 'deposit' ? txn.amount : -txn.amount;
    return { ...txn, runningBalance };
  });

  // Get matter balances
  const matterBalances = await db
    .select({
      matterId: matters.id,
      matterName: matters.name,
      matterNumber: matters.matterNumber,
      clientName: clients.name,
      deposits: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN ${transactions.amount} ELSE 0 END), 0)`,
      disbursements: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'disbursement' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(matters)
    .leftJoin(clients, eq(matters.clientId, clients.id))
    .leftJoin(transactions, eq(transactions.matterId, matters.id))
    .groupBy(matters.id, matters.name, matters.matterNumber, clients.name);

  // Get active holds
  const activeHolds = await db
    .select({
      matterId: holds.matterId,
      totalHolds: sql<number>`COALESCE(SUM(${holds.amount}), 0)`,
    })
    .from(holds)
    .where(eq(holds.status, 'active'))
    .groupBy(holds.matterId);

  const holdsMap = new Map(activeHolds.map(h => [h.matterId, h.totalHolds]));

  const matterSummaries = matterBalances.map(m => ({
    ...m,
    balance: (m.deposits || 0) - (m.disbursements || 0),
    activeHolds: holdsMap.get(m.matterId) || 0,
    availableBalance: ((m.deposits || 0) - (m.disbursements || 0)) - (holdsMap.get(m.matterId) || 0),
  })).filter(m => m.balance !== 0);

  const totalActiveHolds = matterSummaries.reduce((sum, m) => sum + m.activeHolds, 0);

  return {
    firmName: settings.firmName || 'Law Firm',
    bankName: settings.bankName || '',
    accountNumber: settings.accountNumber || '',
    state: settings.state || '',
    startDate,
    endDate,
    openingBalance,
    closingBalance,
    periodDeposits,
    periodDisbursements,
    totalActiveHolds,
    availableBalance: closingBalance - totalActiveHolds,
    transactions: transactionsWithBalance,
    matterSummaries,
    generatedAt: new Date().toISOString(),
  };
}

function generateProfessionalHTML(data: Awaited<ReturnType<typeof generateReportData>>, startDate: string, endDate: string): string {
  // Get state-specific compliance rules
  const complianceRules = getIOLTAComplianceRules(data.state);
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Monthly Trust Account Report - ${data.firmName}</title>
  <style>
    @page { margin: 0.75in; size: letter; }
    body { 
      font-family: Helvetica, Arial, sans-serif; 
      font-size: 11pt; 
      line-height: 1.4;
      color: #000; 
      margin: 0;
      padding: 40px;
    }
    h1 { 
      font-size: 16pt; 
      font-weight: bold; 
      margin: 0 0 5px 0;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
    }
    h2 { 
      font-size: 12pt; 
      font-weight: bold; 
      margin: 25px 0 10px 0;
      border-bottom: 1px solid #000;
      padding-bottom: 5px;
    }
    .header { margin-bottom: 20px; }
    .firm-name { font-size: 14pt; font-weight: bold; margin-bottom: 3px; }
    .report-info { font-size: 10pt; color: #333; margin: 3px 0; }
    .account-info { 
      border: 1px solid #000; 
      padding: 10px; 
      margin: 15px 0;
      font-size: 10pt;
    }
    .account-info p { margin: 3px 0; }
    .summary-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 15px 0;
    }
    .summary-table td { 
      padding: 8px 12px; 
      border: 1px solid #000;
      font-size: 11pt;
    }
    .summary-table .label { font-weight: bold; width: 50%; }
    .summary-table .value { text-align: right; font-family: 'Courier New', monospace; }
    table.data-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 10px 0;
      font-size: 10pt;
    }
    table.data-table th { 
      background: #f0f0f0; 
      text-align: left; 
      padding: 8px 6px; 
      border: 1px solid #000;
      font-weight: bold;
    }
    table.data-table td { 
      padding: 6px; 
      border: 1px solid #000;
      vertical-align: top;
    }
    .amount { text-align: right; font-family: 'Courier New', monospace; }
    .total-row { background: #f0f0f0; font-weight: bold; }
    .footer { 
      margin-top: 30px; 
      padding-top: 15px; 
      border-top: 1px solid #000; 
      font-size: 9pt; 
    }
    .compliance-note { 
      border: 1px solid #000; 
      padding: 10px; 
      margin: 20px 0;
      font-size: 10pt;
    }
    .compliance-note strong { display: block; margin-bottom: 5px; }
    .page-break { page-break-before: always; }
    @media print { 
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="firm-name">${data.firmName}</div>
    <h1>IOLTA TRUST ACCOUNT REPORT</h1>
    ${data.bankName ? `
    <div class="account-info">
      <p><strong>Bank:</strong> ${data.bankName}</p>
      ${data.accountNumber ? `<p><strong>Account:</strong> ****${data.accountNumber.slice(-4)}</p>` : ''}
      ${data.state ? `<p><strong>Jurisdiction:</strong> ${data.state}</p>` : ''}
    </div>
    ` : ''}
    <p class="report-info"><strong>Report Period:</strong> ${formatDate(data.startDate)} through ${formatDate(data.endDate)}</p>
    <p class="report-info"><strong>Generated:</strong> ${formatDate(data.generatedAt)}</p>
  </div>

  <h2>ACCOUNT SUMMARY</h2>
  <table class="summary-table">
    <tr>
      <td class="label">Opening Balance</td>
      <td class="value">${formatCurrency(data.openingBalance)}</td>
    </tr>
    <tr>
      <td class="label">Total Deposits</td>
      <td class="value">${formatCurrency(data.periodDeposits)}</td>
    </tr>
    <tr>
      <td class="label">Total Disbursements</td>
      <td class="value">(${formatCurrency(data.periodDisbursements)})</td>
    </tr>
    <tr>
      <td class="label">Closing Balance</td>
      <td class="value">${formatCurrency(data.closingBalance)}</td>
    </tr>
    ${data.totalActiveHolds > 0 ? `
    <tr>
      <td class="label">Less: Active Holds</td>
      <td class="value">(${formatCurrency(data.totalActiveHolds)})</td>
    </tr>
    <tr>
      <td class="label">Available Balance</td>
      <td class="value">${formatCurrency(data.availableBalance)}</td>
    </tr>
    ` : ''}
  </table>

  <h2>TRANSACTION DETAIL</h2>
  ${data.transactions.length === 0 ? '<p>No transactions during this period.</p>' : `
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:12%">Date</th>
        <th style="width:18%">Matter</th>
        <th style="width:15%">Client</th>
        <th style="width:20%">Description</th>
        <th style="width:8%">Ref</th>
        <th style="width:9%" class="amount">Debit</th>
        <th style="width:9%" class="amount">Credit</th>
        <th style="width:9%" class="amount">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr class="total-row">
        <td colspan="7">Opening Balance</td>
        <td class="amount">${formatCurrency(data.openingBalance)}</td>
      </tr>
      ${data.transactions.map(txn => `
      <tr>
        <td>${formatDate(txn.createdAt)}</td>
        <td>${txn.matterName || '-'}${txn.matterNumber ? ` (#${txn.matterNumber})` : ''}</td>
        <td>${txn.clientName || '-'}</td>
        <td>${txn.description}${txn.payee ? ` - To: ${txn.payee}` : ''}${txn.payor ? ` - From: ${txn.payor}` : ''}</td>
        <td>${txn.checkNumber || '-'}</td>
        <td class="amount">${txn.type === 'disbursement' ? formatCurrency(txn.amount) : ''}</td>
        <td class="amount">${txn.type === 'deposit' ? formatCurrency(txn.amount) : ''}</td>
        <td class="amount">${formatCurrency(txn.runningBalance)}</td>
      </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="5">Period Totals</td>
        <td class="amount">${formatCurrency(data.periodDisbursements)}</td>
        <td class="amount">${formatCurrency(data.periodDeposits)}</td>
        <td class="amount">${formatCurrency(data.closingBalance)}</td>
      </tr>
    </tbody>
  </table>
  `}

  <h2>CLIENT/MATTER BALANCES</h2>
  ${data.matterSummaries.length === 0 ? '<p>No active matter balances.</p>' : `
  <table class="data-table">
    <thead>
      <tr>
        <th>Matter</th>
        <th>Client</th>
        <th>Matter #</th>
        <th class="amount">Balance</th>
        <th class="amount">Holds</th>
        <th class="amount">Available</th>
      </tr>
    </thead>
    <tbody>
      ${data.matterSummaries.map(m => `
      <tr>
        <td>${m.matterName}</td>
        <td>${m.clientName || '-'}</td>
        <td>${m.matterNumber || '-'}</td>
        <td class="amount">${formatCurrency(m.balance)}</td>
        <td class="amount">${m.activeHolds > 0 ? formatCurrency(m.activeHolds) : '-'}</td>
        <td class="amount">${formatCurrency(m.availableBalance)}</td>
      </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="3">TOTAL</td>
        <td class="amount">${formatCurrency(data.closingBalance)}</td>
        <td class="amount">${data.totalActiveHolds > 0 ? formatCurrency(data.totalActiveHolds) : '-'}</td>
        <td class="amount">${formatCurrency(data.availableBalance)}</td>
      </tr>
    </tbody>
  </table>
  `}

  <div class="compliance-note">
    <strong>${complianceRules.state.toUpperCase()} STATE BAR COMPLIANCE REQUIREMENTS</strong>
    <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:9pt;">
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc; width:35%;"><strong>Governing Authority:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.barAssociation}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Record Retention:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.recordRetentionYears} years - ${complianceRules.recordRetentionNote}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Reconciliation:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.reconciliationFrequency.charAt(0).toUpperCase() + complianceRules.reconciliationFrequency.slice(1)} (within ${complianceRules.reconciliationDeadlineDays} days of period end)</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Three-Way Reconciliation:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.threeWayReconciliationRequired ? 'Required' : 'Recommended'}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Annual Report:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.annualReportRequired ? `Required - ${complianceRules.annualReportDeadline}` : 'Not required'}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Disbursement Clearance:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.disbursementClearanceRequired ? `${complianceRules.disbursementClearanceDays} business days recommended` : 'Not specified'}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Overdraft Notification:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.overdraftNotificationRequired ? `Required - Report to ${complianceRules.overdraftNotificationRecipient}` : 'Not required'}</td>
      </tr>
    </table>
    <p style="margin:10px 0 5px 0;"><strong>Key Requirements:</strong></p>
    <ul style="margin:0; padding-left:20px; font-size:9pt;">
      ${complianceRules.specificRules.map(rule => `<li>${rule}</li>`).join('')}
    </ul>
    <p style="margin:10px 0 0 0; font-size:8pt; color:#666;">
      <strong>Citation:</strong> ${complianceRules.rulesCitation}<br/>
      <em>Note: This summary is for informational purposes. Always consult the current rules from ${complianceRules.barAssociation} for the most up-to-date requirements.</em>
    </p>
  </div>

  <div class="footer">
    <p>This report is generated for internal use and bar compliance purposes.</p>
    <p>${data.firmName} | IOLTA Trust Account Report | ${complianceRules.state} Jurisdiction</p>
    <p>Report ID: monthly-trust-${startDate}-${endDate}</p>
  </div>
</body>
</html>`;
}
