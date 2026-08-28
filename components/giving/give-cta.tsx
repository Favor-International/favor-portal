'use client';

// Giving happens inside the portal now.
//
// These used to be links that threw the partner out to favorintl.org in a new
// tab. Will, 2026-08-06: "when I press Start Monthly Giving it still takes me
// to the website to give, which doesn't make sense." They now open the give
// dialog in place. The gift itself is still created by the public giving
// endpoints, so there is exactly one implementation of taking money.

import { Heart, Repeat } from 'lucide-react';
import { GiveDialog } from '@/components/giving/give-dialog';

export function GiveCta({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <GiveDialog
          defaultFrequency="monthly"
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2b4d24] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#24401e]"
            >
              <Repeat className="h-4 w-4" aria-hidden="true" /> Give monthly
            </button>
          }
        />
        <GiveDialog
          defaultFrequency="once"
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e0d6] bg-white px-4 py-2.5 text-sm font-semibold text-[#2b4d24] transition hover:border-[#e1a730]"
            >
              <Heart className="h-4 w-4" aria-hidden="true" /> Give once
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2b4d24]/15 bg-gradient-to-br from-[#2b4d24] to-[#24401e] p-6 text-white shadow-[0_18px_50px_-24px_rgba(43,77,36,0.7)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#e1a730]">Become a Favor Partner</p>
      <h3 className="mt-1 text-xl font-extrabold leading-snug">
        Keep a missionary in the field every month.
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-white/80">
        Monthly partnership is the steady support that lets indigenous leaders plan, stay, and reach
        the hardest places. Start, change, or cancel anytime.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <GiveDialog
          defaultFrequency="monthly"
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#e1a730] px-5 py-2.5 text-sm font-bold text-[#1a1a1a] transition hover:bg-[#d09a24]"
            >
              <Repeat className="h-4 w-4" aria-hidden="true" /> Start monthly giving
            </button>
          }
        />
        <GiveDialog
          defaultFrequency="once"
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
            >
              Or give a one-time gift
            </button>
          }
        />
      </div>
    </div>
  );
}

// Small inline monthly nudge for spots that just need a prompt.
export function GiveMonthlyLink() {
  return (
    <GiveDialog
      defaultFrequency="monthly"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold text-[#2b4d24] hover:underline"
        >
          Become a monthly partner
        </button>
      }
    />
  );
}
