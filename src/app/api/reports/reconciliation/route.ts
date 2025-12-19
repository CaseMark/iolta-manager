import { NextRequest, NextResponse } from 'next/server';
import { db, transactions, matters, clients, trustAccountSettings, holds } from '@/db';
import { eq, sql } from 'drizzle-orm';
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
  .firm-name { font-size: 14pt; font-weight: bold; margin-bottom: 10px; }
  .period { font-size: 10pt; margin: 2px 0; }
  .account-info { 
    border: 1px solid #000; 
    padding: 10px; 
    margin: 10px 0; 
  }
  .account-info p { margin: 3px 0; font-size: 10pt; }
  .reconciliation-box { 
    border: 2px solid #000; 
    padding: 15px; 
    margin: 20px 0;
    text-align: center;
  }
  .reconciliation-box h3 { 
    margin: 0 0 8px 0;
    font-size: 14pt;
  }
  .reconciliation-box p { 
    margin: 0;
    font-size: 10pt;
  }
  .three-way-grid { 
    display: table;
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
  }
  .three-way-row {
    display: table-row;
  }
  .three-way-cell { 
    display: table-cell;
    border: 1px solid #000; 
    padding: 12px;
    width: 33.33%;
    text-align: center;
    vertical-align: top;
  }
  .three-way-cell .label { 
    font-size: 9pt; 
    text-transform: uppercase; 
    font-weight: bold;
    margin-bottom: 5px;
  }
  .three-way-cell .value { 
    font-size: 18pt; 
    font-weight: bold; 
  }
  .three-way-cell .note { 
    font-size: 9pt; 
    margin-top: 5px;
  }
  .diff-section {
    margin: 15px 0;
  }
  .diff-row { 
    display: flex; 
    justify-content: space-between; 
    padding: 8px 12px; 
    border: 1px solid #000;
    margin: -1px 0 0 0;
  }
  .diff-row .label { font-size: 10pt; }
  .diff-row .value { font-weight: bold; font-size: 10pt; }
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
  .signature-line {
    margin-top: 20px;
    font-size: 10pt;
  }
  .signature-line p { margin: 8px 0; }
  .compliance-note { 
    border: 1px solid #000; 
    padding: 12px; 
    margin-top: 20px;
    font-size: 10pt;
  }
  .compliance-note h4 { 
    margin: 0 0 8px 0;
    font-size: 11pt;
  }
  .compliance-note p { margin: 5px 0; }
  .compliance-note ul { margin: 8px 0 0 0; padding-left: 20px; }
  .compliance-note li { margin: 3px 0; }
  @media print { 
    body { margin: 0.5in; }
    @page { margin: 0.5in; }
  }
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { asOfDate, bankStatementBalance } = body;

    const asOf = new Date(asOfDate);
    asOf.setHours(23, 59, 59, 999);

    // Get firm settings
    const settingsResult = await db
      .select()
      .from(trustAccountSettings)
      .limit(1);

    const firmName = settingsResult[0]?.firmName || 'Law Firm';
    const bankName = settingsResult[0]?.bankName || '';
    const accountNumber = settingsResult[0]?.accountNumber || '';
    const state = settingsResult[0]?.state || '';

    // Calculate trust ledger balance (sum of all transactions)
    const trustLedgerResult = await db
      .select({
        deposits: sql<number>`COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)`,
        disbursements: sql<number>`COALESCE(SUM(CASE WHEN type = 'disbursement' THEN amount ELSE 0 END), 0)`,
      })
      .from(transactions);

    const trustLedgerBalance = (trustLedgerResult[0]?.deposits || 0) - (trustLedgerResult[0]?.disbursements || 0);

    // Get all client ledger balances
    const clientLedgers = await db
      .select({
        clientId: clients.id,
        clientName: clients.name,
        deposits: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN ${transactions.amount} ELSE 0 END), 0)`,
        disbursements: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'disbursement' THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(clients)
      .leftJoin(matters, eq(matters.clientId, clients.id))
      .leftJoin(transactions, eq(transactions.matterId, matters.id))
      .where(eq(clients.status, 'active'))
      .groupBy(clients.id, clients.name);

    const clientBalances = clientLedgers.map(c => ({
      ...c,
      balance: (c.deposits || 0) - (c.disbursements || 0),
    })).filter(c => c.balance !== 0);

    const sumOfClientLedgers = clientBalances.reduce((sum, c) => sum + c.balance, 0);

    // Get matter-level breakdown
    const matterLedgers = await db
      .select({
        matterId: matters.id,
        matterName: matters.name,
        matterNumber: matters.matterNumber,
        clientName: clients.name,
        status: matters.status,
        deposits: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'deposit' THEN ${transactions.amount} ELSE 0 END), 0)`,
        disbursements: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'disbursement' THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(matters)
      .leftJoin(clients, eq(matters.clientId, clients.id))
      .leftJoin(transactions, eq(transactions.matterId, matters.id))
      .groupBy(matters.id, matters.name, matters.matterNumber, clients.name, matters.status);

    // Get active holds
    const activeHoldsResult = await db
      .select({
        matterId: holds.matterId,
        totalHolds: sql<number>`COALESCE(SUM(${holds.amount}), 0)`,
      })
      .from(holds)
      .where(eq(holds.status, 'active'))
      .groupBy(holds.matterId);

    const holdsMap = new Map(activeHoldsResult.map(h => [h.matterId, h.totalHolds]));

    const matterBalances = matterLedgers.map(m => ({
      ...m,
      balance: (m.deposits || 0) - (m.disbursements || 0),
      activeHolds: holdsMap.get(m.matterId) || 0,
    })).filter(m => m.balance !== 0);

    const totalActiveHolds = matterBalances.reduce((sum, m) => sum + m.activeHolds, 0);

    // Bank statement balance (user provided or 0)
    const bankBalance = bankStatementBalance ? Math.round(parseFloat(bankStatementBalance) * 100) : 0;

    // Calculate reconciliation
    const ledgerToClientDiff = trustLedgerBalance - sumOfClientLedgers;
    const ledgerToBankDiff = bankBalance > 0 ? trustLedgerBalance - bankBalance : null;

    const isReconciled = ledgerToClientDiff === 0 && (ledgerToBankDiff === null || ledgerToBankDiff === 0);

    // Get state-specific compliance rules
    const complianceRules = getIOLTAComplianceRules(state);

    // Log audit event
    await logAuditEvent({
      entityType: 'report',
      entityId: `reconciliation-${asOfDate}`,
      action: 'create',
      details: {
        reportType: 'reconciliation',
        asOfDate,
        trustLedgerBalance,
        sumOfClientLedgers,
        bankBalance: bankBalance || null,
        isReconciled,
        difference: ledgerToClientDiff,
      },
    });

    // Generate professional HTML report
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Three-Way Reconciliation Report - ${firmName}</title>
  <style>${professionalStyles}</style>
</head>
<body>
  <div class="header">
    <div class="firm-name">${firmName}</div>
    <h1>Three-Way Reconciliation Report</h1>
    ${bankName ? `
    <div class="account-info">
      <p><strong>Bank:</strong> ${bankName}</p>
      ${accountNumber ? `<p><strong>Account:</strong> ****${accountNumber.slice(-4)}</p>` : ''}
      ${state ? `<p><strong>State:</strong> ${state}</p>` : ''}
    </div>
    ` : ''}
    <p class="period">As of: ${formatDate(asOf)}</p>
    <p class="period">Generated: ${formatDate(new Date())}</p>
  </div>

  <div class="reconciliation-box">
    <h3>${isReconciled ? 'RECONCILED' : 'NOT RECONCILED'}</h3>
    <p>${isReconciled 
      ? 'All three balances match. Trust account is properly reconciled.' 
      : 'Discrepancy detected. Review the differences below.'}</p>
  </div>

  <h2>Three-Way Reconciliation Summary</h2>
  <div class="three-way-grid">
    <div class="three-way-row">
      <div class="three-way-cell">
        <div class="label">1. Trust Ledger Balance</div>
        <div class="value">${formatCurrency(trustLedgerBalance)}</div>
        <div class="note">Sum of all transactions</div>
      </div>
      <div class="three-way-cell">
        <div class="label">2. Sum of Client Ledgers</div>
        <div class="value">${formatCurrency(sumOfClientLedgers)}</div>
        <div class="note">Total owed to all clients</div>
      </div>
      <div class="three-way-cell">
        <div class="label">3. Bank Statement Balance</div>
        <div class="value">${bankBalance > 0 ? formatCurrency(bankBalance) : 'Not Provided'}</div>
        <div class="note">Per bank statement</div>
      </div>
    </div>
  </div>

  <h2>Reconciliation Verification</h2>
  <div class="diff-section">
    <div class="diff-row">
      <span class="label">Trust Ledger vs. Client Ledgers Difference:</span>
      <span class="value">${formatCurrency(ledgerToClientDiff)}${ledgerToClientDiff === 0 ? ' (OK)' : ' (DISCREPANCY)'}</span>
    </div>
    ${bankBalance > 0 ? `
    <div class="diff-row">
      <span class="label">Trust Ledger vs. Bank Statement Difference:</span>
      <span class="value">${formatCurrency(ledgerToBankDiff || 0)}${ledgerToBankDiff === 0 ? ' (OK)' : ' (DISCREPANCY)'}</span>
    </div>
    ` : ''}
    ${totalActiveHolds > 0 ? `
    <div class="diff-row">
      <span class="label">Active Holds (Restricted Funds):</span>
      <span class="value">${formatCurrency(totalActiveHolds)}</span>
    </div>
    <div class="diff-row">
      <span class="label">Available for Disbursement:</span>
      <span class="value">${formatCurrency(trustLedgerBalance - totalActiveHolds)}</span>
    </div>
    ` : ''}
  </div>

  <h2>Client Ledger Balances</h2>
  ${clientBalances.length === 0 ? '<p>No client balances.</p>' : `
  <table>
    <thead>
      <tr>
        <th>Client</th>
        <th class="amount">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${clientBalances.map(c => `
      <tr>
        <td>${c.clientName}</td>
        <td class="amount balance">${formatCurrency(c.balance)}</td>
      </tr>
      `).join('')}
      <tr class="total-row">
        <td><strong>Total Client Ledgers</strong></td>
        <td class="amount balance"><strong>${formatCurrency(sumOfClientLedgers)}</strong></td>
      </tr>
    </tbody>
  </table>
  `}

  <h2>Matter Balance Detail</h2>
  ${matterBalances.length === 0 ? '<p>No matter balances.</p>' : `
  <table>
    <thead>
      <tr>
        <th>Matter</th>
        <th>Client</th>
        <th>Matter #</th>
        <th>Status</th>
        <th class="amount">Balance</th>
        <th class="amount">Holds</th>
      </tr>
    </thead>
    <tbody>
      ${matterBalances.map(m => `
      <tr>
        <td>${m.matterName}</td>
        <td>${m.clientName || '-'}</td>
        <td>${m.matterNumber || '-'}</td>
        <td>${m.status}</td>
        <td class="amount balance">${formatCurrency(m.balance)}</td>
        <td class="amount">${m.activeHolds > 0 ? formatCurrency(m.activeHolds) : '-'}</td>
      </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="4"><strong>Total</strong></td>
        <td class="amount balance"><strong>${formatCurrency(sumOfClientLedgers)}</strong></td>
        <td class="amount"><strong>${totalActiveHolds > 0 ? formatCurrency(totalActiveHolds) : '-'}</strong></td>
      </tr>
    </tbody>
  </table>
  `}

  <div class="compliance-note">
    <h4>${complianceRules.state.toUpperCase()} STATE BAR COMPLIANCE REQUIREMENTS</h4>
    <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:9pt;">
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc; width:35%;"><strong>Governing Authority:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.barAssociation}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Reconciliation Frequency:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.reconciliationFrequency.charAt(0).toUpperCase() + complianceRules.reconciliationFrequency.slice(1)} (within ${complianceRules.reconciliationDeadlineDays} days of period end)</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Three-Way Reconciliation:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.threeWayReconciliationRequired ? 'Required' : 'Recommended'}</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Record Retention:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.recordRetentionYears} years</td>
      </tr>
      <tr>
        <td style="padding:4px 8px; border:1px solid #ccc;"><strong>Overdraft Notification:</strong></td>
        <td style="padding:4px 8px; border:1px solid #ccc;">${complianceRules.overdraftNotificationRequired ? `Required - Report to ${complianceRules.overdraftNotificationRecipient}` : 'Not required'}</td>
      </tr>
    </table>
    <p style="margin:10px 0 5px 0;"><strong>Three-Way Reconciliation Components:</strong></p>
    <ul style="margin:0; padding-left:20px; font-size:9pt;">
      <li><strong>Trust Ledger Balance</strong> - The running balance of all deposits and disbursements</li>
      <li><strong>Sum of Client Ledgers</strong> - Total of all individual client sub-accounts</li>
      <li><strong>Bank Statement Balance</strong> - The balance per the bank statement (adjusted for outstanding items)</li>
    </ul>
    <p style="margin:10px 0 0 0; font-size:8pt; color:#666;">
      <strong>Citation:</strong> ${complianceRules.rulesCitation}<br/>
      <em>All three balances must match. Any discrepancy must be investigated and resolved immediately.</em>
    </p>
  </div>

  <div class="footer">
    <p><strong>Three-Way Reconciliation Report</strong></p>
    <p>${firmName} | ${complianceRules.state} Jurisdiction</p>
    <p>Report ID: reconciliation-${asOfDate}</p>
    <div class="signature-line">
      <p><strong>Prepared by:</strong> _________________________ <strong>Date:</strong> _____________</p>
      <p><strong>Reviewed by:</strong> _________________________ <strong>Date:</strong> _____________</p>
    </div>
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="reconciliation-report-${asOfDate}.html"`,
      },
    });
  } catch (error) {
    console.error('Error generating reconciliation report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
