'use client';

import { useCallback, useEffect, useState } from 'react';
import { Repeat, Pause, Play, XCircle, Pencil, HeartHandshake } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import { giveUrl } from '@/lib/give-links';
import { toast } from 'sonner';

// Live recurring giving management, straight from Raiser's Edge NXT through
// the giving gateway. This is the heart of the phase-1 portal: see the
// monthly gift, change it, pause it, resume it, cancel it. When the donor has
// no active schedule, the panel becomes the invitation to start one.

interface Schedule {
  id: string;
  amount: number;
  frequency: string;
  status: string;
  designation: string;
  date: string | null;
}

const GIVE_MONTHLY_URL = giveUrl('monthly');

export function RecurringManager() {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState('');

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

  const act = async (id: string, body: { action: 'pause' | 'resume' | 'cancel' } | { amount: number }, confirmText?: string) => {
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
      toast.success('action' in body
        ? body.action === 'cancel'
          ? 'Your monthly gift has been cancelled.'
          : body.action === 'pause'
            ? 'Your monthly gift is paused.'
            : 'Your monthly gift is active again.'
        : `Monthly amount updated to ${formatCurrency(body.amount)}.`);
      setEditingId(null);
      setNewAmount('');
      await load(true); // force a fresh pull so the change shows immediately
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
                Monthly partnership keeps indigenous missionaries on the trail every single month. Start,
                change, or cancel anytime, right here.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 bg-[#e1a730] text-[#1a1a1a] hover:bg-[#d09a24]">
            <Link href={GIVE_MONTHLY_URL} target="_blank" rel="noopener">
              Start monthly giving
            </Link>
          </Button>
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
                {editingId === s.id ? (
                  <>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder={String(s.amount)}
                      className="w-28"
                      aria-label="New monthly amount"
                    />
                    <Button
                      size="sm"
                      disabled={busyId === s.id || !(Number(newAmount) >= 1)}
                      onClick={() => act(s.id, { amount: Number(newAmount) })}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === s.id}
                      onClick={() => {
                        setEditingId(s.id);
                        setNewAmount(String(s.amount));
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Change amount
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
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <p className="text-xs text-[#6f7766]">
          Changes apply to Favor&rsquo;s donor system immediately. Your card is only charged on your
          regular monthly date.
        </p>
      </CardContent>
    </Card>
  );
}
