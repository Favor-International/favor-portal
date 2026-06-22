'use client';

import { useState, useEffect } from 'react';
import { CommunicationPreferences } from '@/types';

interface UsePreferencesReturn {
  preferences: CommunicationPreferences | null;
  isLoading: boolean;
  error: Error | null;
  updatePreferences: (updates: Partial<CommunicationPreferences>) => Promise<void>;
}

// Raw communication_preferences row as returned by /api/preferences (camelCase).
type PreferenceRow = {
  id: string;
  userId: string;
  emailNewsletterWeekly: boolean | null;
  emailNewsletterMonthly: boolean | null;
  emailQuarterlyReport: boolean | null;
  emailAnnualReport: boolean | null;
  emailEvents: boolean | null;
  emailPrayer: boolean | null;
  emailGivingConfirmations: boolean | null;
  smsEnabled: boolean | null;
  smsGiftConfirmations: boolean | null;
  smsEventReminders: boolean | null;
  smsUrgentOnly: boolean | null;
  mailEnabled: boolean | null;
  mailNewsletterQuarterly: boolean | null;
  mailAnnualReport: boolean | null;
  mailHolidayCard: boolean | null;
  mailAppeals: boolean | null;
  reportPeriod: 'quarterly' | 'annual' | null;
  blackbaudSolicitCodes: string[] | null;
  lastSyncedAt: string | null;
  updatedAt: string | null;
};

export function usePreferences(userId: string | undefined): UsePreferencesReturn {
  const [preferences, setPreferences] = useState<CommunicationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const buildDefaultPreferences = (activeUserId: string): CommunicationPreferences => ({
    id: `pref-${activeUserId}`,
    userId: activeUserId,
    emailNewsletterWeekly: true,
    emailNewsletterMonthly: true,
    emailQuarterlyReport: true,
    emailAnnualReport: true,
    emailEvents: true,
    emailPrayer: true,
    emailGivingConfirmations: true,
    smsEnabled: false,
    smsGiftConfirmations: false,
    smsEventReminders: false,
    smsUrgentOnly: false,
    mailEnabled: true,
    mailNewsletterQuarterly: true,
    mailAnnualReport: true,
    mailHolidayCard: true,
    mailAppeals: false,
    reportPeriod: 'quarterly',
    blackbaudSolicitCodes: [],
    updatedAt: new Date().toISOString(),
  });

  const mapPreferenceRow = (row: PreferenceRow): CommunicationPreferences => ({
    id: row.id,
    userId: row.userId,
    emailNewsletterWeekly: Boolean(row.emailNewsletterWeekly),
    emailNewsletterMonthly: Boolean(row.emailNewsletterMonthly),
    emailQuarterlyReport: Boolean(row.emailQuarterlyReport),
    emailAnnualReport: Boolean(row.emailAnnualReport),
    emailEvents: Boolean(row.emailEvents),
    emailPrayer: Boolean(row.emailPrayer),
    emailGivingConfirmations: Boolean(row.emailGivingConfirmations),
    smsEnabled: Boolean(row.smsEnabled),
    smsGiftConfirmations: Boolean(row.smsGiftConfirmations),
    smsEventReminders: Boolean(row.smsEventReminders),
    smsUrgentOnly: Boolean(row.smsUrgentOnly),
    mailEnabled: Boolean(row.mailEnabled),
    mailNewsletterQuarterly: Boolean(row.mailNewsletterQuarterly),
    mailAnnualReport: Boolean(row.mailAnnualReport),
    mailHolidayCard: Boolean(row.mailHolidayCard),
    mailAppeals: Boolean(row.mailAppeals),
    reportPeriod: row.reportPeriod === 'annual' ? 'annual' : 'quarterly',
    blackbaudSolicitCodes: row.blackbaudSolicitCodes ?? [],
    lastSyncedAt: row.lastSyncedAt || undefined,
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  });

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    const activeUserId = userId;

    let cancelled = false;

    async function fetchPreferences() {
      try {
        setIsLoading(true);

        const response = await fetch('/api/preferences', { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`Failed to load preferences (${response.status})`);
        }
        const data = await response.json();
        if (cancelled) return;

        const row = data.preferences as PreferenceRow | null;
        if (row) {
          setPreferences(mapPreferenceRow(row));
        } else {
          setPreferences(buildDefaultPreferences(activeUserId));
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPreferences();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function updatePreferences(updates: Partial<CommunicationPreferences>) {
    if (!userId) return;

    const base = preferences ?? buildDefaultPreferences(userId);
    const next: CommunicationPreferences = {
      ...base,
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    };

    const response = await fetch('/api/preferences', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailNewsletterWeekly: next.emailNewsletterWeekly,
        emailNewsletterMonthly: next.emailNewsletterMonthly,
        emailQuarterlyReport: next.emailQuarterlyReport,
        emailAnnualReport: next.emailAnnualReport,
        emailEvents: next.emailEvents,
        emailPrayer: next.emailPrayer,
        emailGivingConfirmations: next.emailGivingConfirmations,
        smsEnabled: next.smsEnabled,
        smsGiftConfirmations: next.smsGiftConfirmations,
        smsEventReminders: next.smsEventReminders,
        smsUrgentOnly: next.smsUrgentOnly,
        mailEnabled: next.mailEnabled,
        mailNewsletterQuarterly: next.mailNewsletterQuarterly,
        mailAnnualReport: next.mailAnnualReport,
        mailHolidayCard: next.mailHolidayCard,
        mailAppeals: next.mailAppeals,
        reportPeriod: next.reportPeriod,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update preferences (${response.status})`);
    }

    const data = await response.json();
    const row = data.preferences as PreferenceRow | null;
    setPreferences(row ? mapPreferenceRow(row) : next);
  }

  return { preferences, isLoading, error, updatePreferences };
}
