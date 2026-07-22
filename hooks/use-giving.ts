'use client';

import { useState, useEffect } from 'react';
import { Gift, RecurringGift, GivingSummary } from '@/types';

interface UseGivingReturn {
  gifts: Gift[];
  recurringGifts: RecurringGift[];
  isLoading: boolean;
  error: Error | null;
  totalGiven: number;
  ytdGiven: number;
  summary: GivingSummary | null;
  refresh: () => void;
}

export function useGiving(userId: string | undefined, refreshKey?: number): UseGivingReturn {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [recurringGifts, setRecurringGifts] = useState<RecurringGift[]>([]);
  const [summary, setSummary] = useState<GivingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = () => setRefreshToken((value) => value + 1);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchGiving() {
      try {
        setIsLoading(true);

        // Giving history is served live-first from Blackbaud (Raiser's Edge
        // NXT) via the gateway. Recurring schedules are managed separately
        // through the live RecurringManager (/api/giving/recurring-live), so
        // this hook no longer reads the legacy local-cache recurring endpoint.
        const historyRes = await fetch('/api/giving/history', { credentials: 'include' });

        if (!historyRes.ok) {
          throw new Error(`Failed to load giving history (${historyRes.status})`);
        }

        const historyData = await historyRes.json();
        if (cancelled) return;

        const loadedGifts = ((historyData.gifts ?? []) as Gift[])
          .slice()
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setGifts(loadedGifts);
        setRecurringGifts([]);
        setSummary((historyData.summary ?? null) as GivingSummary | null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchGiving();

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey, refreshToken]);

  const currentYear = new Date().getFullYear();
  const computedTotal = gifts.reduce((sum, g) => sum + g.amount, 0);
  const computedYtd = gifts
    .filter(g => new Date(g.date).getFullYear() === currentYear)
    .reduce((sum, g) => sum + g.amount, 0);

  // Prefer Blackbaud's authoritative lifetime/YTD when present.
  const totalGiven = summary?.lifetimeTotal ?? summary?.totalGiven ?? computedTotal;
  const ytdGiven = summary?.ytdGiven ?? computedYtd;

  return { gifts, recurringGifts, isLoading, error, totalGiven, ytdGiven, summary, refresh };
}
