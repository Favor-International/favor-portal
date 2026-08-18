'use client';

import { useCallback, useEffect, useState } from 'react';
import { Repeat, Pause, Play, XCircle, HeartHandshake, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { GiveDialog } from '@/components/giving/give-dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { vaultNewCard } from '@/lib/blackbaud-checkout';

// Live recurring giving management, straight from Raiser's Edge NXT through
// the giving gateway. See the monthly gift, pause it, resume it, cancel it,
// or change the card. Amount amendments are not available in SKY, so those
// go through the US office.

interface Schedule {
  id: string;
  amount: number;
  frequency: string;
  status: string;
  designation: string;
  date: string | null;
}

export function RecurringManager() {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { user } = useAuth();

  const load = useCallback(async (fresh = false) => {
    try {
      const res = await fetch(`/api/giving/recurring-live${fresh ? '?fresh=1' : ''}`);
      const data = (await res.json()) as { success?: boolean; configured?: boolean; schedules?: Schedule[] };
      setConfigured(data.configured !== false);
      setSchedules(data.schedules ?? []);
    } catch {
      setSchedules([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Replace the card a monthly gift is charged to. Blackbaud collects and
  // vaults the card in its own window; the portal only forwards the token.
  const changeCard = async (id: string) => {
    if (!user?.email) return;
    setBusyId(id);
    try {
      const cardToken = await vaultNewCard({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      if (!cardToken) return; // partner closed the window
      const res = await fetch(`/api/giving/recurring-live/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_card', card_token: cardToken }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || data.success === false) throw new Error(data.error ?? 'Could not update the card');
      toast.success('Your new card is on file. Future gifts use it.');
      void load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the card');
    } finally {
      setBusyId(null);
    }
  };

  const act = async (id: string, body: { action: 'pause' | 'resume' | 'cancel' }, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/giving/recurring-live/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        toast.error(data.error ?? 'The change could not be completed');
        return;
      }
      toast.success(
        body.action === 'cancel'
          ? 'Your monthly gift has been cancelled.'
          : body.action === 'pause'
            ? 'Your monthly gift is paused.'
            : 'Your monthly gift is active again.'
      );
      await load(true);
    } finally {
      setBusyId(null);
    }
  };

  if (!configured || schedules === null) {
    return null;
  }

  const active = schedules.filter((s) => s.status === 'Active');
  const held = schedules.filter((s) => s.status === 'Held');
  const visible = [...active, ...held];

  if (visible.length === 0) {
    return (
      <Card className="border-[#e1a730]/40 bg-gradient-to-br from-[#fdf9ef] to-white">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-full bg-[#2b4d24] p-2 text-white">
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-[#1a1a1a]">Become a monthly Favor Partner</p>
              <p className="text-sm text-[#6f7766]">
                Monthly partnership keeps indigenous missionaries in the field every single month. Start
                or cancel anytime, right here. Amount changes go through the US office.
              </p>
            </div>
          </div>
          <GiveDialog
            defaultFrequency="monthly"
            onDone={() => void load(true)}
            trigger={
              <button
                type="button"
                className="inline-flex h-10 shrink-0 items-center rounded-md bg-[#e1a730] px-4 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#d09a24]"
              >
                Start monthly giving
              </button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4 text-[#2b4d24]" aria-hidden="true" /> Your monthly partnership
        </CardTitle>
        <Badge variant="outline" className="border-[#2b4d24]/30 text-[#2b4d24]">
          Managed live
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {visible.map((s) => (
          <div key={s.id} className="rounded-lg border border-[#e5e0d6] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-extrabold text-[#1a1a1a]">
                  {formatCurrency(s.amount)}
                  <span className="ml-1 text-sm font-semibold text-[#6f7766]">/ month</span>
                </p>
                <p className="text-sm text-[#6f7766]">
                  {s.designation}
                  {s.status === 'Held' ? ' · currently paused' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === s.id}
                  onClick={() => changeCard(s.id)}
                >
                  <CreditCard className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Change card
                </Button>
                {s.status === 'Active' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === s.id}
                    onClick={() => act(s.id, { action: 'pause' }, 'Pause your monthly gift? You can resume anytime.')}
                  >
                    <Pause className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Pause
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={busyId === s.id}
                    onClick={() => act(s.id, { action: 'resume' })}
                  >
                    <Play className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Resume
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  disabled={busyId === s.id}
                  onClick={() =>
                    act(
                      s.id,
                      { action: 'cancel' },
                      'Cancel your monthly gift? The field will feel it; you can restart anytime.',
                    )
                  }
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Cancel
                </Button>
              </div>
            </div>
          </div>
        ))}
        <p className="text-xs text-[#6f7766]">
          Pause, resume, cancel, and card updates apply immediately. To change the monthly amount,
          email{' '}
          <a className="underline" href="mailto:partners@favorintl.org">
            partners@favorintl.org
          </a>
          . Your card is only charged on your regular monthly date.
        </p>
      </CardContent>
    </Card>
  );
}
