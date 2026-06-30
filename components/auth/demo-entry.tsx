'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';

type Persona = 'partner' | 'admin';

export function DemoEntry() {
  const [loading, setLoading] = useState<Persona | null>(null);
  const router = useRouter();

  const enter = async (persona: Persona) => {
    setLoading(persona);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not enter demo');
      router.push(data.redirectTo || '/dashboard');
    } catch {
      toast.error('Could not enter the demo. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-[#e1a730]/35 bg-[#faf7f1] p-5 shadow-[0_4px_16px_-12px_rgba(43,77,36,0.2)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a36d4c]">
        Interactive demo
      </p>
      <h2 className="mt-1 text-lg font-bold tracking-tight text-[#2b4d24]">
        Step inside the portal
      </h2>
      <p className="mt-1 text-sm text-[#6f7766]">
        No sign-up. Explore a fully populated partner account, or see the admin console.
      </p>
      <div className="mt-4 grid gap-2.5">
        <button
          type="button"
          onClick={() => enter('partner')}
          disabled={loading !== null}
          className="group flex items-center justify-between rounded-lg bg-[#e1a730] px-4 py-3 text-left font-semibold text-[#1a1a1a] shadow-[0_8px_24px_-18px_rgba(225,167,48,0.6)] transition hover:bg-[#cf962a] disabled:opacity-60"
        >
          <span className="flex items-center gap-2.5">
            <UserRound className="h-5 w-5" />
            Enter as a Partner
          </span>
          {loading === 'partner'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
        </button>
        <button
          type="button"
          onClick={() => enter('admin')}
          disabled={loading !== null}
          className="group flex items-center justify-between rounded-lg border border-[#2b4d24]/30 bg-white/70 px-4 py-3 text-left font-semibold text-[#2b4d24] transition hover:bg-[#2b4d24] hover:text-[#FFFEF9] disabled:opacity-60"
        >
          <span className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5" />
            Enter as an Admin
          </span>
          {loading === 'admin'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
        </button>
      </div>
    </div>
  );
}
