/**
 * Case.dev Trust Accounting API Client
 * 
 * This service provides secure integration with Case.dev Payments API
 * for trust accounting operations including:
 * - Sub-account management for client matters
 * - Deposit (charge) processing
 * - Disbursement (transfer) processing
 * - Hold management
 * - Ledger queries and balance verification
 */

const CASEDEV_API_BASE = 'https://api.case.dev/payments/v1';

export interface CaseDevConfig {
  apiKey: string;
  trustAccountId?: string | null;
  operatingAccountId?: string | null;
}

export interface CaseDevAccount {
  id: string;
  name: string;
  type: 'trust' | 'operating' | 'sub_account';
  parent_account_id?: string;
  currency: string;
  status: 'active' | 'inactive' | 'suspended';
  metadata?: Record<string, string>;
  created_at: string;
}

export interface CaseDevBalance {
  account_id: string;
  balance: number; // in cents
  available_balance: number; // balance minus holds
  pending_balance: number;
  currency: string;
  as_of: string;
}

export interface CaseDevTransaction {
  id: string;
  account_id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  reference?: string;
  metadata?: Record<string, string>;
  created_at: string;
  completed_at?: string;
}

export interface CaseDevCharge {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  party_id?: string;
  created_at: string;
}

export interface CaseDevTransfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description: string;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  requires_approval: boolean;
  created_at: string;
}

export interface CaseDevHold {
  id: string;
  account_id: string;
  amount: number;
  type: 'retainer' | 'settlement' | 'escrow' | 'compliance';
  description: string;
  status: 'active' | 'released' | 'cancelled';
  required_approvers?: string[];
  created_at: string;
  released_at?: string;
}

export interface CaseDevLedgerEntry {
  id: string;
  account_id: string;
  transaction_id: string;
  type: 'credit' | 'debit' | 'hold' | 'release';
  amount: number;
  running_balance: number;
  description: string;
  created_at: string;
}

export interface CaseDevApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class CaseDevApiException extends Error {
  public code: string;
  public statusCode: number;
  public details?: Record<string, unknown>;

  constructor(message: string, code: string, statusCode: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CaseDevApiException';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class CaseDevPaymentsService {
  private apiKey: string;
  private trustAccountId?: string | null;
  private operatingAccountId?: string | null;

  constructor(config: CaseDevConfig) {
    this.apiKey = config.apiKey;
    this.trustAccountId = config.trustAccountId;
    this.operatingAccountId = config.operatingAccountId;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.trustAccountId);
  }

  /**
   * Make an authenticated request to the Case.dev API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${CASEDEV_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-API-Version': '2024-01',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData: CaseDevApiError;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          code: 'UNKNOWN_ERROR',
          message: response.statusText,
        };
      }
      
      throw new CaseDevApiException(
        errorData.message,
        errorData.code,
        response.status,
        errorData.details
      );
    }

    return response.json();
  }

  // ============================================
  // Account Operations
  // ============================================

  /**
   * Create a sub-account for a client matter
   * This is critical for trust accounting - each matter should have its own sub-account
   */
  async createSubAccount(params: {
    name: string;
    matterId: string;
    clientId: string;
    matterNumber?: string;
  }): Promise<CaseDevAccount> {
    if (!this.trustAccountId) {
      throw new CaseDevApiException(
        'Trust account ID not configured',
        'CONFIGURATION_ERROR',
        400
      );
    }

    return this.request<CaseDevAccount>('/accounts', {
      method: 'POST',
      body: JSON.stringify({
        name: params.name,
        type: 'sub_account',
        parent_account_id: this.trustAccountId,
        currency: 'USD',
        metadata: {
          matter_id: params.matterId,
          client_id: params.clientId,
          matter_number: params.matterNumber || '',
          source: 'iolta_account_manager',
        },
      }),
    });
  }

  /**
   * Get account details
   */
  async getAccount(accountId: string): Promise<CaseDevAccount> {
    return this.request<CaseDevAccount>(`/accounts/${accountId}`);
  }

  /**
   * Get account balance with available funds calculation
   */
  async getAccountBalance(accountId: string): Promise<CaseDevBalance> {
    return this.request<CaseDevBalance>(`/accounts/${accountId}/balance`);
  }

  /**
   * Get the main trust account balance
   */
  async getTrustAccountBalance(): Promise<CaseDevBalance> {
    if (!this.trustAccountId) {
      throw new CaseDevApiException(
        'Trust account ID not configured',
        'CONFIGURATION_ERROR',
        400
      );
    }
    return this.getAccountBalance(this.trustAccountId);
  }

  /**
   * Get account ledger with transaction history
   */
  async getAccountLedger(accountId: string, params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: CaseDevLedgerEntry[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('start_date', params.startDate);
    if (params?.endDate) query.append('end_date', params.endDate);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());
    
    return this.request(`/accounts/${accountId}/ledger?${query}`);
  }

  /**
   * List all sub-accounts (matter accounts) under the trust account
   */
  async listSubAccounts(): Promise<CaseDevAccount[]> {
    if (!this.trustAccountId) {
      throw new CaseDevApiException(
        'Trust account ID not configured',
        'CONFIGURATION_ERROR',
        400
      );
    }

    const result = await this.request<{ accounts: CaseDevAccount[] }>(
      `/accounts?type=sub_account&parent_account_id=${this.trustAccountId}`
    );
    return result.accounts;
  }

  // ============================================
  // Charge Operations (Deposits into Trust)
  // ============================================

  /**
   * Create a charge (deposit) to a sub-account
   * This records funds received for a client matter
   */
  async createCharge(params: {
    accountId: string;
    amount: number; // in cents
    description: string;
    payor?: string;
    reference?: string;
  }): Promise<CaseDevCharge> {
    return this.request<CaseDevCharge>('/charges', {
      method: 'POST',
      body: JSON.stringify({
        account_id: params.accountId,
        amount: params.amount,
        currency: 'USD',
        description: params.description,
        party_id: params.payor,
        reference: params.reference,
        metadata: {
          source: 'iolta_account_manager',
          type: 'trust_deposit',
        },
      }),
    });
  }

  /**
   * Get charge details
   */
  async getCharge(chargeId: string): Promise<CaseDevCharge> {
    return this.request<CaseDevCharge>(`/charges/${chargeId}`);
  }

  // ============================================
  // Transfer Operations (Disbursements)
  // ============================================

  /**
   * Create a transfer from trust sub-account to operating account
   * This is for earned fees disbursements
   */
  async createDisbursementToOperating(params: {
    fromAccountId: string;
    amount: number;
    description: string;
    payee?: string;
    checkNumber?: string;
    requiresApproval?: boolean;
  }): Promise<CaseDevTransfer> {
    if (!this.operatingAccountId) {
      throw new CaseDevApiException(
        'Operating account ID not configured',
        'CONFIGURATION_ERROR',
        400
      );
    }

    return this.request<CaseDevTransfer>('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        from_account_id: params.fromAccountId,
        to_account_id: this.operatingAccountId,
        amount: params.amount,
        description: params.description,
        requires_approval: params.requiresApproval ?? true,
        metadata: {
          source: 'iolta_account_manager',
          type: 'disbursement_to_operating',
          payee: params.payee || '',
          check_number: params.checkNumber || '',
        },
      }),
    });
  }

  /**
   * Create a transfer (general disbursement from trust)
   */
  async createTransfer(params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description: string;
    requiresApproval?: boolean;
    metadata?: Record<string, string>;
  }): Promise<CaseDevTransfer> {
    return this.request<CaseDevTransfer>('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        from_account_id: params.fromAccountId,
        to_account_id: params.toAccountId,
        amount: params.amount,
        description: params.description,
        requires_approval: params.requiresApproval ?? true,
        metadata: {
          source: 'iolta_account_manager',
          ...params.metadata,
        },
      }),
    });
  }

  /**
   * Approve a pending transfer
   */
  async approveTransfer(transferId: string, approverId?: string): Promise<CaseDevTransfer> {
    return this.request<CaseDevTransfer>(`/transfers/${transferId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approver_id: approverId }),
    });
  }

  /**
   * Cancel a pending transfer
   */
  async cancelTransfer(transferId: string, reason: string): Promise<CaseDevTransfer> {
    return this.request<CaseDevTransfer>(`/transfers/${transferId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Get transfer details
   */
  async getTransfer(transferId: string): Promise<CaseDevTransfer> {
    return this.request<CaseDevTransfer>(`/transfers/${transferId}`);
  }

  // ============================================
  // Hold Operations
  // ============================================

  /**
   * Create a hold on funds
   * Holds reduce available balance but don't move funds
   */
  async createHold(params: {
    accountId: string;
    amount: number;
    type: 'retainer' | 'settlement' | 'escrow' | 'compliance';
    description: string;
    requiredApprovers?: string[];
  }): Promise<CaseDevHold> {
    return this.request<CaseDevHold>('/holds', {
      method: 'POST',
      body: JSON.stringify({
        account_id: params.accountId,
        amount: params.amount,
        type: params.type,
        description: params.description,
        required_approvers: params.requiredApprovers,
        metadata: {
          source: 'iolta_account_manager',
        },
      }),
    });
  }

  /**
   * Release a hold
   */
  async releaseHold(holdId: string, reason: string): Promise<CaseDevHold> {
    return this.request<CaseDevHold>(`/holds/${holdId}/release`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Get hold details
   */
  async getHold(holdId: string): Promise<CaseDevHold> {
    return this.request<CaseDevHold>(`/holds/${holdId}`);
  }

  /**
   * List holds for an account
   */
  async listHolds(accountId: string, status?: 'active' | 'released' | 'cancelled'): Promise<CaseDevHold[]> {
    const query = new URLSearchParams({ account_id: accountId });
    if (status) query.append('status', status);
    
    const result = await this.request<{ holds: CaseDevHold[] }>(`/holds?${query}`);
    return result.holds;
  }

  // ============================================
  // Ledger & Reporting
  // ============================================

  /**
   * Get a specific transaction from the ledger
   */
  async getLedgerTransaction(transactionId: string): Promise<CaseDevTransaction> {
    return this.request<CaseDevTransaction>(`/ledger/transactions/${transactionId}`);
  }

  /**
   * Query ledger entries across accounts
   */
  async queryLedger(params: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    type?: 'credit' | 'debit' | 'hold' | 'release';
    limit?: number;
  }): Promise<{ entries: CaseDevLedgerEntry[]; total: number }> {
    const query = new URLSearchParams();
    if (params.accountId) query.append('account_id', params.accountId);
    if (params.startDate) query.append('start_date', params.startDate);
    if (params.endDate) query.append('end_date', params.endDate);
    if (params.type) query.append('type', params.type);
    if (params.limit) query.append('limit', params.limit.toString());
    
    return this.request(`/ledger?${query}`);
  }

  /**
   * Get trust account summary with all sub-accounts and balances
   */
  async getTrustAccountSummary(): Promise<{
    trustAccount: CaseDevBalance;
    subAccounts: Array<CaseDevAccount & { balance: CaseDevBalance }>;
    totalBalance: number;
    totalAvailable: number;
    totalHeld: number;
  }> {
    if (!this.trustAccountId) {
      throw new CaseDevApiException(
        'Trust account ID not configured',
        'CONFIGURATION_ERROR',
        400
      );
    }

    const [trustBalance, subAccounts] = await Promise.all([
      this.getAccountBalance(this.trustAccountId),
      this.listSubAccounts(),
    ]);

    // Get balances for each sub-account
    const subAccountsWithBalances = await Promise.all(
      subAccounts.map(async (account) => {
        const balance = await this.getAccountBalance(account.id);
        return { ...account, balance };
      })
    );

    const totalBalance = subAccountsWithBalances.reduce(
      (sum, acc) => sum + acc.balance.balance, 0
    );
    const totalAvailable = subAccountsWithBalances.reduce(
      (sum, acc) => sum + acc.balance.available_balance, 0
    );
    const totalHeld = totalBalance - totalAvailable;

    return {
      trustAccount: trustBalance,
      subAccounts: subAccountsWithBalances,
      totalBalance,
      totalAvailable,
      totalHeld,
    };
  }

  // ============================================
  // Validation & Verification
  // ============================================

  /**
   * Verify sufficient available funds before a disbursement
   */
  async verifyAvailableFunds(accountId: string, amount: number): Promise<{
    sufficient: boolean;
    balance: number;
    available: number;
    held: number;
    shortfall: number;
  }> {
    const balance = await this.getAccountBalance(accountId);
    const shortfall = amount > balance.available_balance 
      ? amount - balance.available_balance 
      : 0;

    return {
      sufficient: balance.available_balance >= amount,
      balance: balance.balance,
      available: balance.available_balance,
      held: balance.balance - balance.available_balance,
      shortfall,
    };
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.apiKey) {
        return { success: false, message: 'API key not configured' };
      }

      // Try to get trust account info if configured
      if (this.trustAccountId) {
        await this.getAccount(this.trustAccountId);
        return { success: true, message: 'Connected to Case.dev API' };
      }

      // If no trust account, just verify the API key works
      await this.request<{ status: string }>('/health');
      return { success: true, message: 'API key valid, trust account not configured' };
    } catch (error) {
      if (error instanceof CaseDevApiException) {
        return { 
          success: false, 
          message: `API Error: ${error.message} (${error.code})` 
        };
      }
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

/**
 * Create a Case.dev Payments Service instance from environment and settings
 */
export function createCaseDevService(settings?: {
  trustAccountId?: string | null;
  operatingAccountId?: string | null;
}): CaseDevPaymentsService | null {
  const apiKey = process.env.CASEDEV_API_KEY;
  
  if (!apiKey) {
    return null;
  }

  return new CaseDevPaymentsService({
    apiKey,
    trustAccountId: settings?.trustAccountId,
    operatingAccountId: settings?.operatingAccountId,
  });
}

