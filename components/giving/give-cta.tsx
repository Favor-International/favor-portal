import Link from "next/link";
import { Heart, Repeat, ArrowUpRight } from "lucide-react";
import { giveUrl } from "@/lib/give-links";

// Real giving links (open the secure Blackbaud form on favorintl.org in a new
// tab so the portal stays put). Monthly is always the lead action.
export function GiveCta({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={giveUrl("monthly")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2b4d24] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#24401e]"
        >
          <Repeat className="h-4 w-4" aria-hidden="true" /> Give monthly
        </a>
        <a
          href={giveUrl("once")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e0d6] bg-white px-4 py-2.5 text-sm font-semibold text-[#2b4d24] transition hover:border-[#e1a730]"
        >
          <Heart className="h-4 w-4" aria-hidden="true" /> Give once
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2b4d24]/15 bg-gradient-to-br from-[#2b4d24] to-[#24401e] p-6 text-white shadow-[0_18px_50px_-24px_rgba(43,77,36,0.7)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#e1a730]">Become a Favor Partner</p>
      <h3 className="mt-1 text-xl font-extrabold leading-snug">
        Keep a missionary on the trail every month.
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-white/80">
        Monthly partnership is the steady support that lets indigenous leaders plan, stay, and reach
        the hardest places. Start, change, or cancel anytime.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={giveUrl("monthly")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#e1a730] px-5 py-2.5 text-sm font-bold text-[#1a1a1a] transition hover:bg-[#d09a24]"
        >
          <Repeat className="h-4 w-4" aria-hidden="true" /> Start monthly giving
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
        <a
          href={giveUrl("once")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
        >
          Or give a one-time gift
        </a>
      </div>
    </div>
  );
}

// Small inline monthly nudge for spots that just need a link.
export function GiveMonthlyLink() {
  return (
    <Link
      href={giveUrl("monthly")}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold text-[#2b4d24] hover:underline"
    >
      Become a monthly partner <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}
