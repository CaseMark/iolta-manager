import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Demo mode secret - uses NEXTAUTH_SECRET env var if set, otherwise uses demo fallback
const secret = process.env.NEXTAUTH_SECRET || 'demo-secret-for-demo-mode';

/**
 * Next.js Middleware for IOLTA Trust Account Manager
 * 
 * Protects all routes except:
 * - /login (authentication page)
 * - /api/auth/* (NextAuth.js endpoints)
 * - /_next/* (Next.js internals)
 * - /favicon.ico, /robots.txt (static files)
 */

export default withAuth(
  function middleware(req) {
    // Add security headers to all responses
    const response = NextResponse.next();
    
    // These headers are also set in next.config.js, but middleware ensures they're always present
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to login page and auth endpoints without token
        const { pathname } = req.nextUrl;
        
        if (
          pathname.startsWith('/login') ||
          pathname.startsWith('/api/auth') ||
          pathname === '/favicon.ico' ||
          pathname === '/robots.txt'
        ) {
          return true;
        }
        
        // All other routes require authentication
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
    secret,
  }
);

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
