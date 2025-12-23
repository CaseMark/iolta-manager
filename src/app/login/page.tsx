'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [isLoading, setIsLoading] = useState(false);

  const handleEnterDemo = async () => {
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        demo: 'true',
        redirect: false,
        callbackUrl,
      });

      console.log('signIn result:', result);

      if (result?.error) {
        console.error('signIn error:', result.error);
        setIsLoading(false);
        return;
      }

      if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('signIn exception:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 flex justify-center">
      <button
        onClick={handleEnterDemo}
        disabled={isLoading}
        className="inline-flex items-center justify-center py-3 px-8 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Entering...
          </>
        ) : (
          'Enter Demo'
        )}
      </button>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="mt-8 flex justify-center">
      <div className="h-12 w-32 bg-blue-100 rounded-md animate-pulse" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Demo Banner */}
      <div className="bg-gray-100 text-gray-600 px-4 py-1.5 text-center border-b border-gray-200">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs">
            <span className="font-medium">Demo Instance</span> — <strong className="text-gray-800">Do not enter real client or sensitive information.</strong> Want to use this for your firm? <a href="https://github.com/CaseMark/iolta-manager" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Clone the repo</a> and deploy your own instance.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg
                className="h-10 w-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              IOLTA Trust Account Manager
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Explore the demo dashboard
            </p>
          </div>

          {/* Enter Demo Button wrapped in Suspense */}
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>

          {/* Purpose Description - moved above the GitHub box */}
          <div className="text-center text-sm text-gray-600">
            <p>
              This demo shows how law firms can organize and track IOLTA trust accounts, 
              client matters, and transactions.
            </p>
          </div>

          {/* Deploy Your Own */}
          <div className="p-4 bg-blue-50 rounded-md border border-blue-100">
            <div className="text-center">
              <h3 className="text-sm font-medium text-gray-800">
                Want to use this for your firm?
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                This is open source software. Clone the repository and deploy your own secure instance.
              </p>
              <a 
                href="https://github.com/CaseMark/iolta-manager" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
