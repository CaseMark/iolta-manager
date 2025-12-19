/**
 * Case.dev Configuration Helper
 * 
 * Retrieves Case.dev settings from the database and creates service instances.
 */

import { db, trustAccountSettings } from '@/db';
import { CaseDevPaymentsService, createCaseDevService } from './payments';

export interface CaseDevSettings {
  trustAccountId: string | null;
  operatingAccountId: string | null;
  isConfigured: boolean;
  apiKeyPresent: boolean;
}

/**
 * Get Case.dev settings from the database
 */
export async function getCaseDevSettings(): Promise<CaseDevSettings> {
  const settings = await db.select().from(trustAccountSettings).limit(1);
  const apiKeyPresent = !!process.env.CASEDEV_API_KEY;
  
  if (settings.length === 0) {
    return {
      trustAccountId: null,
      operatingAccountId: null,
      isConfigured: false,
      apiKeyPresent,
    };
  }

  const { casedevTrustAccountId, casedevOperatingAccountId } = settings[0];
  
  return {
    trustAccountId: casedevTrustAccountId,
    operatingAccountId: casedevOperatingAccountId,
    isConfigured: !!(apiKeyPresent && casedevTrustAccountId),
    apiKeyPresent,
  };
}

/**
 * Create a Case.dev Payments Service with settings from the database
 * Returns null if not configured
 */
export async function getCaseDevService(): Promise<CaseDevPaymentsService | null> {
  const settings = await getCaseDevSettings();
  
  if (!settings.apiKeyPresent) {
    return null;
  }

  return createCaseDevService({
    trustAccountId: settings.trustAccountId,
    operatingAccountId: settings.operatingAccountId,
  });
}

/**
 * Get a configured Case.dev service or throw an error if not available
 */
export async function requireCaseDevService(): Promise<CaseDevPaymentsService> {
  const service = await getCaseDevService();
  
  if (!service) {
    throw new Error('Case.dev API is not configured. Please set CASEDEV_API_KEY environment variable.');
  }

  return service;
}

/**
 * Check if Case.dev integration is available and configured
 */
export async function isCaseDevAvailable(): Promise<boolean> {
  const settings = await getCaseDevSettings();
  return settings.isConfigured;
}

