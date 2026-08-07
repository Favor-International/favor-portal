'use client';

import { useState } from 'react';
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
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Reset = a sign-in link that drops the partner on the password form. Same
  // proven magic-link path; the mailbox is the credential either way.
  const sendReset = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Enter your email first, then choose Forgot your password.");
      return;
    }
    setSendingReset(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo: "/settings?section=security" }),
      });
      if (!res.ok) throw new Error("Could not send the reset email.");
      setResetSent(true);
      toast.success("Check your email for a link to set a new password.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the reset email.");
    } finally {
      setSendingReset(false);
    }
  };

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
      // Full navigation, not router.push: AuthProvider reads /api/auth/me only
      // on mount, so a soft nav lands on the dashboard with no user loaded.
      window.location.assign(data.redirectTo ?? "/dashboard");
      return;
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
      <button
        type="button"
        className="w-full text-center text-xs text-[#6f7766] underline-offset-4 hover:text-[#2b4d24] hover:underline disabled:opacity-60"
        onClick={sendReset}
        disabled={sendingReset}
      >
        {sendingReset
          ? "Sending reset link…"
          : resetSent
            ? "Reset link sent. Check your email."
            : "Forgot your password?"}
      </button>
    </form>
  );
}
