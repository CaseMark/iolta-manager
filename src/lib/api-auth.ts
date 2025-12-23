import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from './auth';
import { checkRateLimit, RateLimitType } from './rate-limit';

/**
 * API Authentication and Authorization Helper
 * 
 * Provides a unified way to protect API routes with:
 * - Session-based authentication (NextAuth.js)
 * - Rate limiting (Upstash Redis)
 * - Role-based access control
 */

export interface AuthResult {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
  error?: NextResponse;
}

/**
 * Check if the current request is authenticated
 * Returns the user if authenticated, or an error response if not
 */
export async function requireAuth(
  request: NextRequest,
  options: {
    rateLimit?: RateLimitType;
    requiredRole?: string;
  } = {}
): Promise<AuthResult> {
  const { rateLimit = 'general', requiredRole } = options;

  // Check rate limit first
  const rateLimitResponse = await checkRateLimit(request, rateLimit);
  if (rateLimitResponse) {
    return { authenticated: false, error: rateLimitResponse };
  }

  // Check authentication
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  // Check role if required
  if (requiredRole && session.user.role !== requiredRole) {
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  return {
    authenticated: true,
    user: {
      id: session.user.id || '',
      email: session.user.email || '',
      name: session.user.name || undefined,
      role: session.user.role || undefined,
    },
  };
}

/**
 * Higher-order function to wrap API route handlers with auth
 * 
 * Usage:
 * export const GET = withAuth(async (request, { user }) => {
 *   // Your handler code here
 *   return NextResponse.json({ data: 'protected' });
 * });
 */
export function withAuth<T extends NextRequest>(
  handler: (
    request: T,
    context: { user: NonNullable<AuthResult['user']> }
  ) => Promise<NextResponse>,
  options: {
    rateLimit?: RateLimitType;
    requiredRole?: string;
  } = {}
) {
  return async (request: T): Promise<NextResponse> => {
    const authResult = await requireAuth(request, options);

    if (!authResult.authenticated || !authResult.user) {
      return authResult.error!;
    }

    return handler(request, { user: authResult.user });
  };
}

/**
 * Check authentication without requiring it
 * Useful for routes that behave differently for authenticated users
 */
export async function getAuthUser(request: NextRequest): Promise<AuthResult['user'] | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id || '',
    email: session.user.email || '',
    name: session.user.name || undefined,
    role: session.user.role || undefined,
  };
}

/**
 * Simple auth check for API routes - returns error response or null
 * 
 * Usage:
 * export async function GET(request: NextRequest) {
 *   const authError = await checkAuth(request);
 *   if (authError) return authError;
 *   
 *   // Your handler code here
 * }
 */
export async function checkAuth(
  request: NextRequest,
  options: {
    rateLimit?: RateLimitType;
    requiredRole?: string;
  } = {}
): Promise<NextResponse | null> {
  const authResult = await requireAuth(request, options);

  if (!authResult.authenticated) {
    return authResult.error!;
  }

  return null;
}
