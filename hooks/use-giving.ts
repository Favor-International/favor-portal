'use client';

import { useState, useEffect, useRef } from 'react';
import { Gift, RecurringGift, GivingSummary } from '@/types';

interface UseGivingReturn {
  gifts: Gift[];
  recurringGifts: RecurringGift[];
  isLoading: boolean;
  error: Error | null;
  totalGiven: number;
  ytdGiven: number;
  summary: GivingSummary | null;
  pendingSync: boolean;
  refresh: () => void;
}

export function useGiving(userId: string | undefined, refreshKey?: number): UseGivingReturn {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [recurringGifts, setRecurringGifts] = useState<RecurringGift[]>([]);
  const [summary, setSummary] = useState<GivingSummary | null>(null);
  const [pendingSync, setPendingSync] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const autoRefreshStarted = useRef(false);

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
        setPendingSync(Boolean(historyData.pendingSync) && loadedGifts.length === 0);
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

  useEffect(() => {
    if (!pendingSync || autoRefreshStarted.current) return;
    autoRefreshStarted.current = true;
    const first = window.setTimeout(() => setRefreshToken((value) => value + 1), 8000);
    const second = window.setTimeout(() => setRefreshToken((value) => value + 1), 25000);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [pendingSync]);

  const currentYear = new Date().getFullYear();
  const computedTotal = gifts.reduce((sum, g) => sum + g.amount, 0);
  const computedYtd = gifts
    .filter(g => new Date(g.date).getFullYear() === currentYear)
    .reduce((sum, g) => sum + g.amount, 0);

  // Prefer Blackbaud's authoritative lifetime/YTD when present, but never
  // let a live 0 hide gifts already sitting in the local cache.
  const totalGiven = Math.max(
    Number(summary?.lifetimeTotal ?? 0),
    Number(summary?.totalGiven ?? 0),
    computedTotal,
  );
  const ytdGiven = Math.max(Number(summary?.ytdGiven ?? 0), computedYtd);

  return { gifts, recurringGifts, isLoading, error, totalGiven, ytdGiven, summary, pendingSync, refresh };
}
