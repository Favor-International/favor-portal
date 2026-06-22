'use client';

import { useState, useEffect } from 'react';
import { Gift, RecurringGift } from '@/types';

interface UseGivingReturn {
  gifts: Gift[];
  recurringGifts: RecurringGift[];
  isLoading: boolean;
  error: Error | null;
  totalGiven: number;
  ytdGiven: number;
  refresh: () => void;
}

export function useGiving(userId: string | undefined, refreshKey?: number): UseGivingReturn {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [recurringGifts, setRecurringGifts] = useState<RecurringGift[]>([]);
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

        const [historyRes, recurringRes] = await Promise.all([
          fetch('/api/giving/history', { credentials: 'include' }),
          fetch('/api/giving/recurring', { credentials: 'include' }),
        ]);

        if (!historyRes.ok) {
          throw new Error(`Failed to load giving history (${historyRes.status})`);
        }
        if (!recurringRes.ok) {
          throw new Error(`Failed to load recurring gifts (${recurringRes.status})`);
        }

        const historyData = await historyRes.json();
        const recurringData = await recurringRes.json();
        if (cancelled) return;

        const loadedGifts = ((historyData.gifts ?? []) as Gift[])
          .slice()
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const loadedRecurring = ((recurringData.gifts ?? []) as RecurringGift[]).filter(
          (gift) => gift.status === 'active'
        );

        setGifts(loadedGifts);
        setRecurringGifts(loadedRecurring);
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

  const totalGiven = gifts.reduce((sum, g) => sum + g.amount, 0);

  const currentYear = new Date().getFullYear();
  const ytdGiven = gifts
    .filter(g => new Date(g.date).getFullYear() === currentYear)
    .reduce((sum, g) => sum + g.amount, 0);

  return { gifts, recurringGifts, isLoading, error, totalGiven, ytdGiven, refresh };
}
