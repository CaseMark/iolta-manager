/**
 * State-specific IOLTA Compliance Guidelines
 * 
 * This module contains IOLTA (Interest on Lawyer Trust Accounts) compliance
 * requirements for each U.S. state. Requirements vary significantly by jurisdiction.
 * 
 * Sources: State Bar Association Rules, ABA Model Rules
 * Last Updated: December 2024
 */

export interface IOLTAComplianceRules {
  state: string;
  stateCode: string;
  barAssociation: string;
  
  // Record Retention
  recordRetentionYears: number;
  recordRetentionNote: string;
  
  // Reconciliation Requirements
  reconciliationFrequency: 'monthly' | 'quarterly';
  reconciliationDeadlineDays: number; // Days after period end
  threeWayReconciliationRequired: boolean;
  
  // Reporting Requirements
  annualReportRequired: boolean;
  annualReportDeadline: string; // e.g., "March 1" or "Within 60 days of fiscal year end"
  
  // Trust Account Requirements
  minimumBalanceForInterest: number; // In cents, 0 if no minimum
  separateAccountPerClient: boolean;
  pooledAccountAllowed: boolean;
  
  // Disbursement Rules
  disbursementClearanceRequired: boolean;
  disbursementClearanceDays: number;
  
  // Overdraft Notification
  overdraftNotificationRequired: boolean;
  overdraftNotificationRecipient: string;
  
  // Specific Rules
  specificRules: string[];
  
  // Citation
  rulesCitation: string;
  rulesUrl: string;
}

// Comprehensive state-specific IOLTA compliance rules
export const STATE_IOLTA_RULES: Record<string, IOLTAComplianceRules> = {
  'Alabama': {
    state: 'Alabama',
    stateCode: 'AL',
    barAssociation: 'Alabama State Bar',
    recordRetentionYears: 6,
    recordRetentionNote: 'Records must be retained for 6 years after termination of representation',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: false,
    annualReportDeadline: 'N/A',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 3,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'Alabama State Bar Disciplinary Commission',
    specificRules: [
      'Trust accounts must be maintained in Alabama-approved financial institutions',
      'Monthly reconciliation of trust accounts is mandatory',
      'Client ledgers must be maintained for each client matter'
    ],
    rulesCitation: 'Alabama Rules of Professional Conduct, Rule 1.15',
    rulesUrl: 'https://www.alabar.org/office-of-general-counsel/rules-of-professional-conduct/'
  },
  
  'California': {
    state: 'California',
    stateCode: 'CA',
    barAssociation: 'State Bar of California',
    recordRetentionYears: 5,
    recordRetentionNote: 'Records must be retained for 5 years after final distribution or termination',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: true,
    annualReportDeadline: 'February 1 (with annual registration)',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 5,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'State Bar of California',
    specificRules: [
      'Trust accounts must be in California banks or federally insured institutions',
      'Monthly written reconciliation required within 30 days',
      'Three-way reconciliation: bank statement, client ledgers, trust account register',
      'Must report trust account information annually with bar registration',
      'Electronic records acceptable if properly backed up'
    ],
    rulesCitation: 'California Rules of Professional Conduct, Rule 1.15',
    rulesUrl: 'https://www.calbar.ca.gov/Attorneys/Conduct-Discipline/Rules/Rules-of-Professional-Conduct'
  },
  
  'Colorado': {
    state: 'Colorado',
    stateCode: 'CO',
    barAssociation: 'Colorado Bar Association',
    recordRetentionYears: 7,
    recordRetentionNote: 'Records must be retained for 7 years after termination of representation',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: true,
    annualReportDeadline: 'With annual registration',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 3,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'Office of Attorney Regulation Counsel',
    specificRules: [
      'Trust accounts must be in Colorado-approved financial institutions',
      'Monthly reconciliation required',
      'Must maintain individual client ledgers',
      'Overdraft notification agreement required with bank'
    ],
    rulesCitation: 'Colorado Rules of Professional Conduct, Rule 1.15',
    rulesUrl: 'https://www.coloradosupremecourt.com/Current%20Lawyers/RulesOfProfessionalConduct.asp'
  },
  
  'Florida': {
    state: 'Florida',
    stateCode: 'FL',
    barAssociation: 'The Florida Bar',
    recordRetentionYears: 6,
    recordRetentionNote: 'Records must be retained for 6 years after termination of representation',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: true,
    annualReportDeadline: 'With annual bar dues (varies by member)',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 5,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'The Florida Bar',
    specificRules: [
      'Trust accounts must be in Florida Bar-approved financial institutions',
      'Monthly reconciliation required within 30 days',
      'Three-way reconciliation mandatory',
      'Must report trust account information with annual bar dues',
      'Random trust account audits may be conducted'
    ],
    rulesCitation: 'Rules Regulating The Florida Bar, Rule 5-1.2',
    rulesUrl: 'https://www.floridabar.org/rules/rrtfb/'
  },
  
  'Georgia': {
    state: 'Georgia',
    stateCode: 'GA',
    barAssociation: 'State Bar of Georgia',
    recordRetentionYears: 6,
    recordRetentionNote: 'Records must be retained for 6 years after termination',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: false,
    annualReportDeadline: 'N/A',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 3,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'State Bar of Georgia',
    specificRules: [
      'Trust accounts must be in Georgia-approved financial institutions',
      'Monthly reconciliation required',
      'Individual client ledgers mandatory',
      'Overdraft notification agreement required'
    ],
    rulesCitation: 'Georgia Rules of Professional Conduct, Rule 1.15',
    rulesUrl: 'https://www.gabar.org/barrules/georgia-rules-of-professional-conduct.cfm'
  },
  
  'Illinois': {
    state: 'Illinois',
    stateCode: 'IL',
    barAssociation: 'Illinois State Bar Association',
    recordRetentionYears: 7,
    recordRetentionNote: 'Records must be retained for 7 years after termination',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: true,
    annualReportDeadline: 'With annual registration',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 3,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'Attorney Registration and Disciplinary Commission',
    specificRules: [
      'Trust accounts must be in Illinois-approved financial institutions',
      'Monthly reconciliation required',
      'Must maintain individual client ledgers',
      'Trust account information reported with annual registration'
    ],
    rulesCitation: 'Illinois Rules of Professional Conduct, Rule 1.15',
    rulesUrl: 'https://www.isba.org/ibj/2010/01/illinoisrulesofprofessionalconduct'
  },
  
  'Massachusetts': {
    state: 'Massachusetts',
    stateCode: 'MA',
    barAssociation: 'Massachusetts Bar Association',
    recordRetentionYears: 6,
    recordRetentionNote: 'Records must be retained for 6 years after termination',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: false,
    annualReportDeadline: 'N/A',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 3,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: "Board of Bar Overseers",
    specificRules: [
      'Trust accounts must be in Massachusetts-approved financial institutions',
      'Monthly reconciliation required',
      'Three-way reconciliation mandatory',
      'Overdraft notification agreement required with bank'
    ],
    rulesCitation: 'Massachusetts Rules of Professional Conduct, Rule 1.15',
    rulesUrl: 'https://www.mass.gov/rules-of-professional-conduct'
  },
  
  'New York': {
    state: 'New York',
    stateCode: 'NY',
    barAssociation: 'New York State Bar Association',
    recordRetentionYears: 7,
    recordRetentionNote: 'Records must be retained for 7 years after the events they record',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: true,
    annualReportDeadline: 'With biennial registration',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 3,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'Lawyers Fund for Client Protection',
    specificRules: [
      'Trust accounts must be in New York-approved banking institutions',
      'Monthly reconciliation required',
      'Three-way reconciliation: bank statement, client ledgers, checkbook register',
      'Must report trust account information with biennial registration',
      'Dishonored check notification required to Lawyers Fund'
    ],
    rulesCitation: 'New York Rules of Professional Conduct, Rule 1.15',
    rulesUrl: 'https://www.nycourts.gov/rules/jointappellate/NY-Rules-Prof-Conduct-1200.pdf'
  },
  
  'Pennsylvania': {
    state: 'Pennsylvania',
    stateCode: 'PA',
    barAssociation: 'Pennsylvania Bar Association',
    recordRetentionYears: 5,
    recordRetentionNote: 'Records must be retained for 5 years after termination',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: true,
    annualReportDeadline: 'With annual registration',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 3,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'Disciplinary Board of the Supreme Court',
    specificRules: [
      'Trust accounts must be in Pennsylvania-approved financial institutions',
      'Monthly reconciliation required',
      'Must maintain individual client ledgers',
      'Trust account certification required with annual registration'
    ],
    rulesCitation: 'Pennsylvania Rules of Professional Conduct, Rule 1.15',
    rulesUrl: 'https://www.padisciplinaryboard.org/for-attorneys/rules'
  },
  
  'Texas': {
    state: 'Texas',
    stateCode: 'TX',
    barAssociation: 'State Bar of Texas',
    recordRetentionYears: 5,
    recordRetentionNote: 'Records must be retained for 5 years after termination of representation',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: true,
    annualReportDeadline: 'With annual bar dues',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 5,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'State Bar of Texas Chief Disciplinary Counsel',
    specificRules: [
      'Trust accounts must be in Texas-approved financial institutions',
      'Monthly reconciliation required',
      'Three-way reconciliation mandatory',
      'Must report trust account information with annual bar dues',
      'Random compliance audits may be conducted'
    ],
    rulesCitation: 'Texas Disciplinary Rules of Professional Conduct, Rule 1.14',
    rulesUrl: 'https://www.texasbar.com/AM/Template.cfm?Section=Grievance_Info_and_Ethics_Helpline'
  },
  
  'Washington': {
    state: 'Washington',
    stateCode: 'WA',
    barAssociation: 'Washington State Bar Association',
    recordRetentionYears: 7,
    recordRetentionNote: 'Records must be retained for 7 years after termination',
    reconciliationFrequency: 'monthly',
    reconciliationDeadlineDays: 30,
    threeWayReconciliationRequired: true,
    annualReportRequired: true,
    annualReportDeadline: 'With annual licensing',
    minimumBalanceForInterest: 0,
    separateAccountPerClient: false,
    pooledAccountAllowed: true,
    disbursementClearanceRequired: true,
    disbursementClearanceDays: 3,
    overdraftNotificationRequired: true,
    overdraftNotificationRecipient: 'Washington State Bar Association',
    specificRules: [
      'Trust accounts must be in Washington-approved financial institutions',
      'Monthly reconciliation required',
      'Must maintain individual client ledgers',
      'Trust account certification required with annual licensing'
    ],
    rulesCitation: 'Washington Rules of Professional Conduct, Rule 1.15A',
    rulesUrl: 'https://www.courts.wa.gov/court_rules/?fa=court_rules.list&group=ga&set=RPC'
  },
};

// Default rules for states not explicitly listed
export const DEFAULT_IOLTA_RULES: IOLTAComplianceRules = {
  state: 'Default',
  stateCode: 'XX',
  barAssociation: 'State Bar Association',
  recordRetentionYears: 5,
  recordRetentionNote: 'Records should be retained for at least 5 years after termination (check your state bar rules)',
  reconciliationFrequency: 'monthly',
  reconciliationDeadlineDays: 30,
  threeWayReconciliationRequired: true,
  annualReportRequired: false,
  annualReportDeadline: 'Check with your state bar',
  minimumBalanceForInterest: 0,
  separateAccountPerClient: false,
  pooledAccountAllowed: true,
  disbursementClearanceRequired: true,
  disbursementClearanceDays: 3,
  overdraftNotificationRequired: true,
  overdraftNotificationRecipient: 'Your state bar disciplinary authority',
  specificRules: [
    'Trust accounts must be in approved financial institutions',
    'Monthly reconciliation is recommended',
    'Maintain individual client ledgers',
    'Check your state bar rules for specific requirements'
  ],
  rulesCitation: 'ABA Model Rules of Professional Conduct, Rule 1.15',
  rulesUrl: 'https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_15_safekeeping_property/'
};

/**
 * Get IOLTA compliance rules for a specific state
 */
export function getIOLTAComplianceRules(state: string | null | undefined): IOLTAComplianceRules {
  if (!state) {
    return DEFAULT_IOLTA_RULES;
  }
  
  // Normalize state name (handle variations)
  const normalizedState = normalizeStateName(state);
  
  return STATE_IOLTA_RULES[normalizedState] || {
    ...DEFAULT_IOLTA_RULES,
    state: state,
    recordRetentionNote: `Records should be retained per ${state} State Bar rules (typically 5-7 years)`,
    specificRules: [
      `Trust accounts must be in ${state}-approved financial institutions`,
      'Monthly reconciliation is recommended',
      'Maintain individual client ledgers',
      `Check ${state} State Bar rules for specific requirements`
    ],
  };
}

/**
 * Normalize state name to match our records
 */
function normalizeStateName(state: string): string {
  const stateMap: Record<string, string> = {
    'ca': 'California',
    'california': 'California',
    'ny': 'New York',
    'new york': 'New York',
    'tx': 'Texas',
    'texas': 'Texas',
    'fl': 'Florida',
    'florida': 'Florida',
    'il': 'Illinois',
    'illinois': 'Illinois',
    'pa': 'Pennsylvania',
    'pennsylvania': 'Pennsylvania',
    'ga': 'Georgia',
    'georgia': 'Georgia',
    'ma': 'Massachusetts',
    'massachusetts': 'Massachusetts',
    'wa': 'Washington',
    'washington': 'Washington',
    'co': 'Colorado',
    'colorado': 'Colorado',
    'al': 'Alabama',
    'alabama': 'Alabama',
  };
  
  const normalized = state.toLowerCase().trim();
  return stateMap[normalized] || state;
}

/**
 * Generate compliance note HTML for reports
 */
export function generateComplianceNoteHTML(rules: IOLTAComplianceRules): string {
  return `
    <div class="compliance-section">
      <h3>STATE BAR COMPLIANCE REQUIREMENTS - ${rules.state.toUpperCase()}</h3>
      <table class="compliance-table">
        <tr>
          <td><strong>Governing Authority:</strong></td>
          <td>${rules.barAssociation}</td>
        </tr>
        <tr>
          <td><strong>Record Retention:</strong></td>
          <td>${rules.recordRetentionYears} years - ${rules.recordRetentionNote}</td>
        </tr>
        <tr>
          <td><strong>Reconciliation:</strong></td>
          <td>${rules.reconciliationFrequency.charAt(0).toUpperCase() + rules.reconciliationFrequency.slice(1)} (within ${rules.reconciliationDeadlineDays} days)</td>
        </tr>
        <tr>
          <td><strong>Three-Way Reconciliation:</strong></td>
          <td>${rules.threeWayReconciliationRequired ? 'Required' : 'Recommended'}</td>
        </tr>
        <tr>
          <td><strong>Annual Report:</strong></td>
          <td>${rules.annualReportRequired ? `Required - ${rules.annualReportDeadline}` : 'Not required'}</td>
        </tr>
        <tr>
          <td><strong>Disbursement Clearance:</strong></td>
          <td>${rules.disbursementClearanceRequired ? `${rules.disbursementClearanceDays} business days` : 'Not specified'}</td>
        </tr>
        <tr>
          <td><strong>Overdraft Notification:</strong></td>
          <td>${rules.overdraftNotificationRequired ? `Required - Report to ${rules.overdraftNotificationRecipient}` : 'Not required'}</td>
        </tr>
      </table>
      
      <div class="specific-rules">
        <strong>Key Requirements:</strong>
        <ul>
          ${rules.specificRules.map(rule => `<li>${rule}</li>`).join('')}
        </ul>
      </div>
      
      <p class="citation"><strong>Citation:</strong> ${rules.rulesCitation}</p>
      <p class="disclaimer">
        <em>Note: This summary is for informational purposes. Always consult the current rules 
        from ${rules.barAssociation} for the most up-to-date requirements.</em>
      </p>
    </div>
  `;
}

/**
 * Get list of all supported states
 */
export function getSupportedStates(): string[] {
  return Object.keys(STATE_IOLTA_RULES).sort();
}
