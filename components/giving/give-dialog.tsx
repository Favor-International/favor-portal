'use client';

// Giving without leaving the portal.
//
// Will, 2026-08-06: "when I press Start Monthly Giving it still takes me to the
// website to give, which doesn't make sense."
//
// The gift is created by the SAME handlers the public form uses. Nothing
// about money is reimplemented: the portal posts to its own /api/giving/give,
// which forwards server-side to favor-astro's /api/portal/give, which
// delegates straight into the public donate handlers. Same validation, same
// fee maths, same appeal stamping, same constituent matching.
//
// Going through our own server (rather than posting to favorintl.org from the
// browser) avoids exposing the giving endpoints cross-origin, avoids asking an
// already-signed-in partner to solve a bot challenge, and avoids mailing them
// a "here is your login link" welcome email they do not need.
//
// Card entry happens inside Blackbaud Checkout, so no card data touches the
// portal, exactly as on the public site.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeartHandshake, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { getGiveConfig, openBlackbaudCheckout, type GiveConfig } from '@/lib/blackbaud-checkout';

const PRESETS = [25, 50, 100, 250];

interface GiveDialogProps {
  defaultFrequency?: 'monthly' | 'once';
  trigger?: React.ReactNode;
  onDone?: () => void;
}

export function GiveDialog({ defaultFrequency = 'monthly', trigger, onDone }: GiveDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<GiveConfig | null>(null);
  const [frequency, setFrequency] = useState<'monthly' | 'once'>(defaultFrequency);
  const [amount, setAmount] = useState<string>('50');
  const [fundId, setFundId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    getGiveConfig()
      .then((c) => {
        setConfig(c);
        const preferred =
          c.designations.find((d) => /where needed most/i.test(d.label)) ?? c.designations[0];
        setFundId((prev) => prev || preferred?.fund_id || '');
      })
      .catch(() => toast.error('Giving is briefly unavailable. Please try again shortly.'));
  }, [open]);

  const numericAmount = useMemo(() => Math.round(Number(amount) * 100) / 100, [amount]);
  const valid = Number.isFinite(numericAmount) && numericAmount >= 1 && !!fundId;

  const submit = useCallback(async () => {
    if (!valid || !config || !user?.email) return;
    setBusy(true);
    try {
      const cardToken = crypto.randomUUID();
      // Monthly gifts must vault the card so Blackbaud can charge it again,
      // which is why wallets are disabled for them.
      const checkout = await openBlackbaudCheckout({
        config,
        amount: numericAmount,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        cardToken: frequency === 'monthly' ? cardToken : undefined,
        description: frequency === 'monthly' ? 'Favor Partner monthly gift (first month)' : 'Gift to Favor International',
        allowWallets: frequency === 'once',
      });
      if (!checkout) {
        setBusy(false);
        return; // partner closed Checkout
      }

      const res = await fetch('/api/giving/give', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency,
          amount: numericAmount,
          designation_fund_id: fundId,
          transaction_token: checkout.transactionToken,
          ...(frequency === 'monthly' ? { card_token: cardToken } : {}),
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? 'The gift could not be completed.');

      toast.success(
        frequency === 'monthly'
          ? 'Your monthly partnership has started. Thank you.'
          : 'Your gift is complete. Thank you.'
      );
      setOpen(false);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The gift could not be completed.');
    } finally {
      setBusy(false);
    }
  }, [valid, config, user, numericAmount, fundId, frequency, onDone]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <Button>
            <HeartHandshake className="mr-2 h-4 w-4" aria-hidden="true" />
            {defaultFrequency === 'monthly' ? 'Start monthly giving' : 'Give a gift'}
          </Button>
        )}
      </div>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{frequency === 'monthly' ? 'Start monthly giving' : 'Give a gift'}</DialogTitle>
          <DialogDescription>
            Your card is entered in Blackbaud&apos;s secure window. Favor never sees it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={frequency === 'monthly' ? 'default' : 'outline'}
              onClick={() => setFrequency('monthly')}
            >
              Monthly
            </Button>
            <Button
              type="button"
              variant={frequency === 'once' ? 'default' : 'outline'}
              onClick={() => setFrequency('once')}
            >
              One-time
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="give-amount">Amount</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={amount === String(p) ? 'default' : 'outline'}
                  onClick={() => setAmount(String(p))}
                >
                  ${p}
                </Button>
              ))}
            </div>
            <Input
              id="give-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              aria-label="Gift amount in dollars"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="give-fund">Designation</Label>
            <Select value={fundId} onValueChange={setFundId}>
              <SelectTrigger id="give-fund">
                <SelectValue placeholder="Choose where it goes" />
              </SelectTrigger>
              <SelectContent>
                {(config?.designations ?? []).map((d) => (
                  <SelectItem key={d.fund_id} value={d.fund_id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <Button className="w-full" disabled={!valid || busy || !config} onClick={submit}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Working...
              </>
            ) : (
              `Continue to card`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
