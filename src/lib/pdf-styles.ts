import { StyleSheet } from '@react-pdf/renderer';

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333333',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
  },
  summaryContainer: {
    flexDirection: 'row',
    marginVertical: 15,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryLabel: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  summaryValuePositive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
  },
  summaryValueNegative: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 20,
    marginBottom: 10,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 5,
    backgroundColor: '#fafafa',
  },
  tableRowTotal: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 9,
    color: '#333333',
  },
  tableCellSmall: {
    fontSize: 8,
    color: '#6b7280',
  },
  tableCellBold: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  amountCell: {
    fontSize: 9,
    fontFamily: 'Courier',
    textAlign: 'right',
  },
  amountCellCredit: {
    fontSize: 9,
    fontFamily: 'Courier',
    textAlign: 'right',
    color: '#059669',
  },
  amountCellDebit: {
    fontSize: 9,
    fontFamily: 'Courier',
    textAlign: 'right',
    color: '#dc2626',
  },
  amountCellBold: {
    fontSize: 9,
    fontFamily: 'Courier',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  // Column widths for transaction table
  colDate: { width: '10%' },
  colMatter: { width: '18%' },
  colDescription: { width: '24%' },
  colRef: { width: '8%' },
  colDebit: { width: '13%' },
  colCredit: { width: '13%' },
  colBalance: { width: '14%' },
  // Column widths for matter balance table
  colMatterName: { width: '30%' },
  colClient: { width: '30%' },
  colMatterNum: { width: '20%' },
  colMatterBalance: { width: '20%' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: '#6b7280',
  },
  noData: {
    fontSize: 10,
    color: '#6b7280',
    fontStyle: 'italic',
    marginVertical: 10,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    fontSize: 8,
    color: '#6b7280',
  },
});

export const colors = {
  primary: '#1e40af',
  success: '#059669',
  danger: '#dc2626',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  border: '#e5e7eb',
};
