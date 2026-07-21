"use client";

import { type FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarClock, CheckCircle, Clock, FileText, Lock, MessageCircle, Send } from "lucide-react";
import type { SupportTicket } from "@/types";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";

type SupportCategory = "giving" | "account" | "courses" | "technical" | "other";

function getTopicPreset(topic: string | null, contentTitle: string | null) {
  switch (topic) {
    case "strategic-call":
      return { category: "other" as SupportCategory, subject: "Request strategic call with RDD", message: "I would like to schedule a strategic call with my RDD to review stewardship priorities." };
    case "content-access":
      return { category: "courses" as SupportCategory, subject: `Request access: ${contentTitle ?? "Locked content item"}`, message: "Please review my access level for this content item and let me know if it can be unlocked." };
    case "account-help":
      return { category: "account" as SupportCategory, subject: "Account support request", message: "I need help with my profile, sign-in, or account settings." };
    case "technical-issue":
      return { category: "technical" as SupportCategory, subject: "Technical issue report", message: "I encountered a technical issue in the portal. Steps to reproduce:" };
    default:
      return { category: undefined, subject: "", message: "" };
  }
}

export default function SupportPage() {
  return (
    <Suspense fallback={<PortalPageSkeleton />}>
      <SupportPageContent />
    </Suspense>
  );
}

function SupportPageContent() {
  const searchParams = useSearchParams();
  const topic = searchParams.get("topic");
  const contentTitle = searchParams.get("contentTitle");
  const preset = useMemo(() => getTopicPreset(topic, contentTitle), [topic, contentTitle]);

  const [category, setCategory] = useState<SupportCategory | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (preset.category && !category) setCategory(preset.category);
    if (preset.subject && !subject) setSubject(preset.subject);
    if (preset.message && !message) setMessage(preset.message);
  }, [preset, category, subject, message]);

  useEffect(() => {
    let isMounted = true;
    async function loadTickets() {
      try {
        const response = await fetch("/api/support", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed");
        const payload = await response.json();
        if (!isMounted) return;
        setTickets(Array.isArray(payload.tickets) ? (payload.tickets as SupportTicket[]) : []);
      } catch {
        if (isMounted) setTickets([]);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    }
    void loadTickets();
    return () => { isMounted = false; };
  }, []);

  function applyPreset(t: string) {
    const next = getTopicPreset(t, contentTitle);
    setCategory(next.category ?? "");
    setSubject(next.subject);
    setMessage(next.message);
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (!category || !subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject: subject.trim(), message: message.trim() }),
      });
      if (!response.ok) throw new Error("Failed");
      const payload = await response.json();
      const ticket = payload.ticket as SupportTicket;
      if (!ticket?.id) throw new Error("Invalid");
      setTickets((current) => [ticket, ...current]);
      setSubject("");
      setMessage("");
      toast.success("Support request submitted", { description: "We'll follow up within 1-2 business days." });
    } catch {
      toast.error("Unable to submit support request");
    } finally {
      setSubmitting(false);
    }
  }

  const presets = [
    { id: "strategic-call", icon: CalendarClock, title: "Strategic call", desc: "Plan with your RDD" },
    { id: "content-access", icon: Lock, title: "Content access", desc: "Unlock a report or course" },
    { id: "technical-issue", icon: FileText, title: "Technical issue", desc: "Report something broken" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <nav className="mb-2 flex items-center gap-1 text-xs text-[#8b957b]">
          <Link href="/dashboard" className="hover:text-[#2b4d24]">Home</Link>
          <span>/</span>
          <span className="font-medium text-[#2b4d24]">Support</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">Support</h1>
        <p className="mt-1 text-sm text-[#6f7766]">Submit a request and track your conversations with our partner team.</p>
      </div>

      {/* Quick presets */}
      <div className="grid gap-4 sm:grid-cols-3">
        {presets.map((p) => (
          <button key={p.id} onClick={() => applyPreset(p.id)} className="text-left">
            <Card className="glass-transition glass-hover h-full">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2b4d24]/8 text-[#2b4d24]"><p.icon className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold text-[#1a1a1a]">{p.title}</p>
                  <p className="text-xs text-[#8b957b]">{p.desc}</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Two-pane: form + history */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-bold tracking-tight text-[#1a1a1a]">Submit a request</h2>
            <form onSubmit={submitRequest} className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as SupportCategory)}>
                  <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="giving">Giving and receipts</SelectItem>
                    <SelectItem value="account">Account and login</SelectItem>
                    <SelectItem value="courses">Courses and content</SelectItem>
                    <SelectItem value="technical">Technical issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of your request" />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={7} placeholder="Add the details our team needs to help you quickly." />
              </div>
              <Button type="submit" disabled={!category || !subject.trim() || !message.trim() || submitting}>
                <Send className="mr-2 h-4 w-4" />
                {submitting ? "Submitting..." : "Submit request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-bold tracking-tight text-[#1a1a1a]">Your requests</h2>
            <div className="mt-4 space-y-3">
              {loadingHistory ? (
                <p className="text-sm text-[#8b957b]">Loading your requests...</p>
              ) : tickets.length === 0 ? (
                <div className="rounded-xl bg-[#faf7f1] p-6 text-center">
                  <MessageCircle className="mx-auto h-7 w-7 text-[#c5ccc2]" />
                  <p className="mt-2 text-sm text-[#6f7766]">No requests yet. Submit one and it&apos;ll show up here.</p>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl border border-[#e5e0d6] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1a1a1a]">{ticket.subject}</p>
                        <p className="text-xs capitalize text-[#8b957b]">{ticket.category}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={ticket.status === "open" ? "bg-[#e1a730]/15 text-[#a36d4c]" : ticket.status === "resolved" ? "bg-[#2b4d24]/10 text-[#2b4d24]" : ""}
                      >
                        {ticket.status === "open" && <Clock className="mr-1 h-3 w-3" />}
                        {ticket.status === "resolved" && <CheckCircle className="mr-1 h-3 w-3" />}
                        {ticket.status}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-[#6f7766]">{ticket.message}</p>
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-[#a8b0a0]">
                      <span>{new Date(ticket.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      {ticket.messages?.length ? (
                        <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{ticket.messages.length} message(s)</span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
