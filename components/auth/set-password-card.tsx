'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Optional password for donors who prefer it over email links. Setting a
// password never disables magic links; both always work.
export function SetPasswordCard() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) {
      toast.error('Use at least 10 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/auth/password/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        toast.error(data.error ?? 'Could not save the password');
        return;
      }
      toast.success('Password saved. You can now sign in with it anytime.');
      setPassword('');
      setConfirm('');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[#2b4d24]" />
          <h2 className="text-base font-bold tracking-tight text-[#1a1a1a]">Password sign-in</h2>
        </div>
        <p className="mt-1 text-xs text-[#8b957b]">
          Email sign-in links always work. Set a password if you would rather type one.
        </p>
        <form onSubmit={submit} className="mt-4 max-w-sm space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
