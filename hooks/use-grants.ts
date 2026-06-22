'use client';

import { useState, useEffect } from 'react';
import { FoundationGrant } from '@/types';

interface UseGrantsReturn {
  grants: FoundationGrant[];
  isLoading: boolean;
  error: Error | null;
  totalGranted: number;
  activeGrants: number;
}

export function useGrants(userId: string | undefined): UseGrantsReturn {
  const [grants, setGrants] = useState<FoundationGrant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchGrants() {
      try {
        setIsLoading(true);

        const response = await fetch('/api/grants', { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to load grants (${response.status})`);
        }
        const data = await response.json();
        if (cancelled) return;

        setGrants((data.grants ?? []) as FoundationGrant[]);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchGrants();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const totalGranted = grants.reduce((sum, g) => sum + g.amount, 0);
  const activeGrants = grants.filter(g => g.status === 'active').length;

  return { grants, isLoading, error, totalGranted, activeGrants };
}
