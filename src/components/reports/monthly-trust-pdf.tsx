import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from '@/lib/pdf-styles';

interface Transaction {
  id: string;
  matterId: string;
  type: string;
  amount: number;
  description: string;
  payee: string | null;
  payor: string | null;
  checkNumber: string | null;
  createdAt: Date | string | number;
  matterName: string | null;
  matterNumber: string | null;
  clientName: string | null;
  runningBalance: number;
}

interface MatterSummary {
  matterId: string;
  matterName: string | null;
  matterNumber: string | null;
  clientName: string | null;
  balance: number;
}

interface ReportData {
  startDate: string;
  endDate: string;
  generatedAt: string;
  openingBalance: number;
  periodDeposits: number;
  periodDisbursements: number;
  closingBalance: number;
  transactions: Transaction[];
  matterSummaries: MatterSummary[];
  firmName?: string;
  accountName?: string;
}

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

export function MonthlyTrustPDF({ data }: { data: ReportData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {data.firmName && (
            <Text style={{ fontSize: 12, color: '#374151', marginBottom: 3 }}>
              {data.firmName}
            </Text>
          )}
          <Text style={styles.title}>IOLTA Trust Account Report</Text>
          {data.accountName && (
            <Text style={styles.subtitle}>{data.accountName}</Text>
          )}
          <Text style={styles.subtitle}>
            Period: {formatDate(data.startDate)} - {formatDate(data.endDate)}
          </Text>
          <Text style={styles.subtitle}>
            Generated: {formatDate(data.generatedAt)}
          </Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Opening Balance</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(data.openingBalance)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Deposits</Text>
            <Text style={styles.summaryValuePositive}>
              +{formatCurrency(data.periodDeposits)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Disbursements</Text>
            <Text style={styles.summaryValueNegative}>
              -{formatCurrency(data.periodDisbursements)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Closing Balance</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(data.closingBalance)}
            </Text>
          </View>
        </View>

        {/* Transaction Detail Section */}
        <Text style={styles.sectionTitle}>Transaction Detail</Text>
        
        {data.transactions.length === 0 ? (
          <Text style={styles.noData}>No transactions in this period.</Text>
        ) : (
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.colDate}>
                <Text style={styles.tableHeaderCell}>Date</Text>
              </View>
              <View style={styles.colMatter}>
                <Text style={styles.tableHeaderCell}>Matter</Text>
              </View>
              <View style={styles.colDescription}>
                <Text style={styles.tableHeaderCell}>Description</Text>
              </View>
              <View style={styles.colRef}>
                <Text style={styles.tableHeaderCell}>Ref</Text>
              </View>
              <View style={styles.colDebit}>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Debit</Text>
              </View>
              <View style={styles.colCredit}>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Credit</Text>
              </View>
              <View style={styles.colBalance}>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Balance</Text>
              </View>
            </View>

            {/* Opening Balance Row */}
            <View style={styles.tableRow}>
              <View style={{ width: '86%' }}>
                <Text style={styles.tableCellBold}>Opening Balance</Text>
              </View>
              <View style={styles.colBalance}>
                <Text style={styles.amountCellBold}>
                  {formatCurrency(data.openingBalance)}
                </Text>
              </View>
            </View>

            {/* Transaction Rows */}
            {data.transactions.map((txn, index) => (
              <View 
                key={txn.id} 
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <View style={styles.colDate}>
                  <Text style={styles.tableCell}>{formatDate(txn.createdAt)}</Text>
                </View>
                <View style={styles.colMatter}>
                  <Text style={styles.tableCell}>{txn.matterName || '-'}</Text>
                  <Text style={styles.tableCellSmall}>{txn.clientName || ''}</Text>
                </View>
                <View style={styles.colDescription}>
                  <Text style={styles.tableCell}>{txn.description}</Text>
                  {txn.payor && (
                    <Text style={styles.tableCellSmall}>From: {txn.payor}</Text>
                  )}
                  {txn.payee && (
                    <Text style={styles.tableCellSmall}>To: {txn.payee}</Text>
                  )}
                </View>
                <View style={styles.colRef}>
                  <Text style={styles.tableCell}>{txn.checkNumber || '-'}</Text>
                </View>
                <View style={styles.colDebit}>
                  <Text style={styles.amountCellDebit}>
                    {txn.type === 'disbursement' ? formatCurrency(txn.amount) : ''}
                  </Text>
                </View>
                <View style={styles.colCredit}>
                  <Text style={styles.amountCellCredit}>
                    {txn.type === 'deposit' ? formatCurrency(txn.amount) : ''}
                  </Text>
                </View>
                <View style={styles.colBalance}>
                  <Text style={styles.amountCellBold}>
                    {formatCurrency(txn.runningBalance)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This report is generated for internal use and bar compliance purposes.
          </Text>
          <Text style={styles.footerText}>IOLTA Trust Account Manager</Text>
        </View>

        {/* Page Number */}
        <Text 
          style={styles.pageNumber} 
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} 
          fixed 
        />
      </Page>

      {/* Second Page - Matter Balances */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Client/Matter Balances</Text>
          <Text style={styles.subtitle}>
            As of {formatDate(data.endDate)}
          </Text>
        </View>

        {data.matterSummaries.length === 0 ? (
          <Text style={styles.noData}>No active matter balances.</Text>
        ) : (
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.colMatterName}>
                <Text style={styles.tableHeaderCell}>Matter</Text>
              </View>
              <View style={styles.colClient}>
                <Text style={styles.tableHeaderCell}>Client</Text>
              </View>
              <View style={styles.colMatterNum}>
                <Text style={styles.tableHeaderCell}>Matter #</Text>
              </View>
              <View style={styles.colMatterBalance}>
                <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>Balance</Text>
              </View>
            </View>

            {/* Matter Rows */}
            {data.matterSummaries.map((matter, index) => (
              <View 
                key={matter.matterId} 
                style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <View style={styles.colMatterName}>
                  <Text style={styles.tableCell}>{matter.matterName || '-'}</Text>
                </View>
                <View style={styles.colClient}>
                  <Text style={styles.tableCell}>{matter.clientName || '-'}</Text>
                </View>
                <View style={styles.colMatterNum}>
                  <Text style={styles.tableCell}>{matter.matterNumber || '-'}</Text>
                </View>
                <View style={styles.colMatterBalance}>
                  <Text style={styles.amountCellBold}>
                    {formatCurrency(matter.balance)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Total Row */}
            <View style={styles.tableRowTotal}>
              <View style={{ width: '80%' }}>
                <Text style={styles.tableCellBold}>Total Trust Account Balance</Text>
              </View>
              <View style={styles.colMatterBalance}>
                <Text style={styles.amountCellBold}>
                  {formatCurrency(data.closingBalance)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This report is generated for internal use and bar compliance purposes.
          </Text>
          <Text style={styles.footerText}>IOLTA Trust Account Manager</Text>
        </View>

        {/* Page Number */}
        <Text 
          style={styles.pageNumber} 
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} 
          fixed 
        />
      </Page>
    </Document>
  );
}
