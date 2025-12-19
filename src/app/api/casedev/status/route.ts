import { NextResponse } from 'next/server';
import { getCaseDevService, getCaseDevSettings } from '@/lib/casedev';

/**
 * GET /api/casedev/status - Get Case.dev integration status and test connection
 */
export async function GET() {
  try {
    const settings = await getCaseDevSettings();
    
    // Basic status without connection test
    const status = {
      apiKeyPresent: settings.apiKeyPresent,
      trustAccountConfigured: !!settings.trustAccountId,
      operatingAccountConfigured: !!settings.operatingAccountId,
      isConfigured: settings.isConfigured,
      connectionStatus: 'not_tested' as 'not_tested' | 'connected' | 'error',
      connectionMessage: '',
      trustAccountBalance: null as number | null,
      availableBalance: null as number | null,
    };

    // Only test connection if configured
    if (settings.isConfigured) {
      const service = await getCaseDevService();
      if (service) {
        const connectionTest = await service.testConnection();
        status.connectionStatus = connectionTest.success ? 'connected' : 'error';
        status.connectionMessage = connectionTest.message;

        // If connected, get trust account balance
        if (connectionTest.success && settings.trustAccountId) {
          try {
            const balance = await service.getTrustAccountBalance();
            status.trustAccountBalance = balance.balance;
            status.availableBalance = balance.available_balance;
          } catch (error) {
            console.error('Failed to fetch trust account balance:', error);
          }
        }
      }
    } else if (!settings.apiKeyPresent) {
      status.connectionMessage = 'CASEDEV_API_KEY environment variable not set';
    } else if (!settings.trustAccountId) {
      status.connectionMessage = 'Trust Account ID not configured in settings';
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error checking Case.dev status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check Case.dev status',
        apiKeyPresent: false,
        isConfigured: false,
        connectionStatus: 'error',
        connectionMessage: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/casedev/status - Test Case.dev connection
 */
export async function POST() {
  try {
    const service = await getCaseDevService();
    
    if (!service) {
      return NextResponse.json({
        success: false,
        message: 'Case.dev API key not configured. Please set CASEDEV_API_KEY environment variable.',
      });
    }

    const result = await service.testConnection();

    // If successful and configured, get summary
    if (result.success && service.isConfigured()) {
      try {
        const summary = await service.getTrustAccountSummary();
        return NextResponse.json({
          ...result,
          trustAccountBalance: summary.trustAccount.balance,
          availableBalance: summary.trustAccount.available_balance,
          subAccountCount: summary.subAccounts.length,
          totalClientFunds: summary.totalBalance,
          totalHeld: summary.totalHeld,
        });
      } catch {
        // Return basic success if summary fails
        return NextResponse.json(result);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing Case.dev connection:', error);
    return NextResponse.json(
      { 
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

