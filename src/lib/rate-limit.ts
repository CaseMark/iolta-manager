import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limiting configuration for IOLTA Trust Account Manager
 * 
 * Uses Upstash Redis for distributed rate limiting.
 * Falls back to no rate limiting if Upstash is not configured.
 */

// Create Redis client if configured
function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('Upstash Redis not configured - rate limiting disabled');
    return null;
  }

  return new Redis({
    url,
    token,
  });
}

// Rate limiter instances for different endpoints
let generalRateLimiter: Ratelimit | null = null;
let authRateLimiter: Ratelimit | null = null;
let reportRateLimiter: Ratelimit | null = null;

/**
 * Initialize rate limiters
 * Call this once at startup or lazily on first use
 */
function initRateLimiters() {
  const redis = getRedisClient();
  
  if (!redis) {
    return;
  }

  // General API rate limit: 100 requests per 60 seconds
  generalRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '60 s'),
    analytics: true,
    prefix: 'iolta:ratelimit:general',
  });

  // Auth rate limit: 5 attempts per 60 seconds (stricter for login)
  authRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    analytics: true,
    prefix: 'iolta:ratelimit:auth',
  });

  // Report generation rate limit: 10 per minute (expensive operations)
  reportRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: true,
    prefix: 'iolta:ratelimit:reports',
  });
}

// Initialize on module load
initRateLimiters();

/**
 * Get client identifier for rate limiting
 * Uses IP address or forwarded IP from proxy
 */
function getClientIdentifier(request: NextRequest): string {
  // Check for forwarded IP (when behind proxy/load balancer)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Check for real IP header
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (shouldn't happen in production)
  return 'unknown';
}

export type RateLimitType = 'general' | 'auth' | 'reports';

/**
 * Check rate limit for a request
 * Returns null if allowed, or a NextResponse if rate limited
 */
export async function checkRateLimit(
  request: NextRequest,
  type: RateLimitType = 'general'
): Promise<NextResponse | null> {
  let limiter: Ratelimit | null = null;

  switch (type) {
    case 'auth':
      limiter = authRateLimiter;
      break;
    case 'reports':
      limiter = reportRateLimiter;
      break;
    default:
      limiter = generalRateLimiter;
  }

  // If rate limiting is not configured, allow the request
  if (!limiter) {
    return null;
  }

  const identifier = getClientIdentifier(request);
  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  if (!success) {
    return NextResponse.json(
      { 
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Rate limit headers to add to successful responses
 */
export async function getRateLimitHeaders(
  request: NextRequest,
  type: RateLimitType = 'general'
): Promise<Record<string, string>> {
  let limiter: Ratelimit | null = null;

  switch (type) {
    case 'auth':
      limiter = authRateLimiter;
      break;
    case 'reports':
      limiter = reportRateLimiter;
      break;
    default:
      limiter = generalRateLimiter;
  }

  if (!limiter) {
    return {};
  }

  const identifier = getClientIdentifier(request);
  const { limit, remaining, reset } = await limiter.limit(identifier);

  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': reset.toString(),
  };
}
