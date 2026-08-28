// Utilities for persisting portal state locally during a session

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded - ignore
  }
}

// --- Notifications ---
import { Notification } from './portal-mock-data';
import { Gift, SupportTicket } from '@/types';

// v2: the v1 key holds demo notifications that shipped to real partners.
// Bumping it retires those copies from every browser that cached them.
const NOTIF_KEY = 'favor_notifications_v2';
const TICKETS_KEY = 'favor_support_tickets';
const LOCAL_GIFTS_KEY = 'favor_local_gifts';
const SETTINGS_KEY = 'favor_settings';

export function getNotifications(): Notification[] {
  return getItem<Notification[]>(NOTIF_KEY, []);
}

export function saveNotifications(notifications: Notification[]): void {
  setItem(NOTIF_KEY, notifications);
}

export function markNotificationRead(id: string): Notification[] {
  const all = getNotifications().map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
  saveNotifications(all);
  return all;
}

export function markAllNotificationsRead(): Notification[] {
  const all = getNotifications().map((n) => ({ ...n, read: true }));
  saveNotifications(all);
  return all;
}

// --- Support Tickets ---
export function getSupportTickets(): SupportTicket[] {
  return getItem<SupportTicket[]>(TICKETS_KEY, []);
}

export function saveSupportTickets(tickets: SupportTicket[]): void {
  setItem(TICKETS_KEY, tickets);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('favor:support'));
  }
}

export function addSupportTicket(ticket: Omit<SupportTicket, 'id' | 'status' | 'createdAt'>): SupportTicket {
  const newTicket: SupportTicket = {
    ...ticket,
    id: `ticket-${Date.now()}`,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  const tickets = getSupportTickets();
  tickets.unshift(newTicket);
  saveSupportTickets(tickets);
  return newTicket;
}

export function updateSupportTicketStatus(id: string, status: SupportTicket['status']): SupportTicket[] {
  const updated = getSupportTickets().map((ticket) =>
    ticket.id === id ? { ...ticket, status } : ticket
  );
  saveSupportTickets(updated);
  return updated;
}

// --- Local Gifts (from "Give Now" flow) ---
export function getLocalGifts(): Gift[] {
  return getItem<Gift[]>(LOCAL_GIFTS_KEY, []);
}

export function addLocalGift(gift: Omit<Gift, 'id'>): Gift {
  const newGift: Gift = {
    ...gift,
    id: `local-gift-${Date.now()}`,
  };
  const gifts = getLocalGifts();
  gifts.unshift(newGift);
  setItem(LOCAL_GIFTS_KEY, gifts);
  return newGift;
}

// --- Settings persistence ---
export function getLocalSettings(): Record<string, unknown> {
  return getItem<Record<string, unknown>>(SETTINGS_KEY, {});
}

export function saveLocalSettings(settings: Record<string, unknown>): void {
  setItem(SETTINGS_KEY, settings);
}
