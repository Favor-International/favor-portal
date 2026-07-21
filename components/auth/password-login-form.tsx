'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Optional password sign-in. Magic links stay the lead path; this lives
// collapsed under the email form for donors who prefer a password (set one
// anytime from Settings after signing in).
export function PasswordLoginForm() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@') || !password) {
      toast.error('Enter your email and password');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/password/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; redirectTo?: string };
      if (!res.ok || !data.success) {
        toast.error(data.error ?? 'Invalid email or password');
        return;
      }
      router.push(data.redirectTo ?? '/dashboard');
      router.refresh();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) {
    return (
      <p className="mt-4 text-center text-xs text-[#6f7766]">
        Prefer a password?{' '}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-medium text-[#2b4d24] underline"
        >
          Sign in with a password
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3 rounded-lg border border-[#e5e0d6] bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#2b4d24]">
        <KeyRound className="h-4 w-4" aria-hidden="true" /> Sign in with a password
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="pw-email">Email</Label>
        <Input
          id="pw-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-password">Password</Label>
        <Input
          id="pw-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-center text-xs text-[#6f7766]">
        No password yet? Sign in with the email link above, then set one in Settings.
      </p>
    </form>
  );
}
