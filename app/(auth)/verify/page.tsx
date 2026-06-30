'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#2b4d24]" />
        <p className="mt-4 text-[#666666]">Verifying your login...</p>
      </div>
    </div>
  );
}

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? searchParams.get('token_hash');
  const scope = searchParams.get('scope') === 'admin' ? 'admin' : 'portal';
  const redirectParam = searchParams.get('redirect');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('The login link may have expired or is invalid.');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Missing login token. Please request a new link.');
      return;
    }

    async function verifyToken() {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            scope,
            redirectTo: redirectParam,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          const message = typeof payload?.error === 'string' ? payload.error : 'Verification failed';
          throw new Error(message);
        }

        setStatus('success');
        toast.success('Successfully logged in!');
        
        // Redirect after a brief delay based on verified scope.
        const target =
          typeof payload?.redirectTo === 'string'
            ? payload.redirectTo
            : scope === 'admin'
              ? '/admin'
              : '/dashboard';
        setTimeout(() => {
          router.push(target);
        }, 1500);
      } catch (error) {
        setStatus('error');
        const message = error instanceof Error ? error.message : 'Failed to verify login link. Please try again.';
        setErrorMessage(message);
        toast.error(message);
      }
    }

    verifyToken();
  }, [token, router, scope, redirectParam]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent">
      <div className="text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#2b4d24]" />
            <p className="mt-4 text-[#666666]">Verifying your login...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#2b4d24]">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-sans tracking-tight text-2xl text-[#1a1a1a]">Login Successful!</h1>
            <p className="mt-2 text-[#666666]">Redirecting to your dashboard...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="font-sans tracking-tight text-2xl text-[#1a1a1a]">Verification Failed</h1>
            <p className="mt-2 text-[#666666]">{errorMessage}</p>
            <button 
              onClick={() => router.push(scope === 'admin' ? '/admin/login' : '/login')}
              className="mt-4 text-[#2b4d24] underline"
            >
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <VerifyContent />
    </Suspense>
  );
}
