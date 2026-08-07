"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePreferences } from "@/hooks/use-preferences";
import { useAuth } from "@/hooks/use-auth";
import {
  Mail, MessageSquare, Mailbox, FileBarChart, ShieldCheck, Save, Check, Download,
  Newspaper, CalendarDays, ReceiptText, Smartphone, Package, HelpCircle, KeyRound,
  type LucideIcon,
} from "lucide-react";
import { SetPasswordCard } from "@/components/auth/set-password-card";
import Link from "next/link";
import { toast } from "sonner";
import { ContactSupportButton } from "@/components/portal/contact-support-button";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";

type SectionId = "communications" | "security" | "privacy";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "communications", label: "Communications & Stories", icon: Mail },
  { id: "security", label: "Sign-in & Security", icon: KeyRound },
  { id: "privacy", label: "Privacy & Help", icon: ShieldCheck },
];

function ToggleRow({
  icon: Icon, label, desc, checked, onChange, id,
}: { icon: LucideIcon; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2b4d24]/8 text-[#2b4d24]">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <label htmlFor={id} className="text-sm font-medium text-[#1a1a1a]">{label}</label>
          <p className="text-xs text-[#8b957b]">{desc}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { preferences, isLoading, updatePreferences } = usePreferences(user?.id);
  const [section, setSection] = useState<SectionId>("communications");

  // A password-reset email lands here with ?section=security so the partner
  // does not have to hunt for the form.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested === "security" || requested === "privacy" || requested === "communications") {
      setSection(requested);
    }
  }, []);

  const [emailNewsletter, setEmailNewsletter] = useState(true);
  const [emailEvents, setEmailEvents] = useState(true);
  const [emailGiving, setEmailGiving] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsGiftConfirmations, setSmsGiftConfirmations] = useState(false);
  const [mailEnabled, setMailEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!preferences) return;
    setEmailNewsletter(preferences.emailNewsletterMonthly);
    setEmailEvents(preferences.emailEvents);
    setEmailGiving(preferences.emailGivingConfirmations);
    setSmsEnabled(preferences.smsEnabled);
    setSmsGiftConfirmations(preferences.smsGiftConfirmations);
    setMailEnabled(preferences.mailEnabled);
  }, [preferences]);

  async function handleSave() {
    setSaving(true);
    try {
      await updatePreferences({
        emailNewsletterMonthly: emailNewsletter,
        emailEvents,
        emailGivingConfirmations: emailGiving,
        smsEnabled,
        smsGiftConfirmations,
        mailEnabled,
      });
      setSaving(false);
      setSaved(true);
      toast.success("Preferences saved");
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaving(false);
      toast.error("Failed to save preferences");
    }
  }

  if (isLoading) return <PortalPageSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <nav className="mb-2 flex items-center gap-1 text-xs text-[#8b957b]">
          <Link href="/dashboard" className="hover:text-[#2b4d24]">Home</Link>
          <span>/</span>
          <span className="font-medium text-[#2b4d24]">Settings</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">Settings</h1>
        <p className="mt-1 text-sm text-[#6f7766]">Manage how Favor keeps in touch and what you receive.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Section nav */}
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition ${
                  active
                    ? "bg-[#2b4d24] text-[#FFFEF9] shadow-[0_8px_24px_-18px_rgba(43,77,36,0.5)]"
                    : "text-[#4f594a] hover:bg-white/60"
                }`}
              >
                <s.icon className={`h-4 w-4 ${active ? "text-[#e1a730]" : "text-[#8b957b]"}`} />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Panels */}
        <div className="space-y-5">
          {section === "communications" && (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#2b4d24]" />
                    <h2 className="text-base font-bold tracking-tight text-[#1a1a1a]">Email</h2>
                  </div>
                  <p className="mt-1 text-xs text-[#8b957b]">Stories from the field and updates on your partnership.</p>
                  <div className="mt-2 divide-y divide-[#e5e0d6]">
                    <ToggleRow id="newsletter" icon={Newspaper} label="Monthly newsletter" desc="Updates and stories from the field." checked={emailNewsletter} onChange={setEmailNewsletter} />
                    <ToggleRow id="events" icon={CalendarDays} label="Event invitations" desc="Upcoming events and webinars." checked={emailEvents} onChange={setEmailEvents} />
                    <ToggleRow id="giving" icon={ReceiptText} label="Giving confirmations" desc="Receipts when your gift is processed." checked={emailGiving} onChange={setEmailGiving} />
                  </div>
                  <p className="mt-3 text-xs text-[#8b957b]">
                    Switching every email option off records a do-not-email flag on your
                    record in Favor&rsquo;s donor database. Individual choices above are kept
                    in your portal account.
                  </p>
                  <div className="hidden">
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[#2b4d24]" />
                    <h2 className="text-base font-bold tracking-tight text-[#1a1a1a]">Text messages</h2>
                  </div>
                  <div className="mt-2 divide-y divide-[#e5e0d6]">
                    <ToggleRow id="sms-enabled" icon={Smartphone} label="Enable SMS" desc="Allow text message notifications." checked={smsEnabled} onChange={setSmsEnabled} />
                    {smsEnabled && (
                      <ToggleRow id="sms-gifts" icon={ReceiptText} label="Gift confirmations" desc="Text when your gift is processed." checked={smsGiftConfirmations} onChange={setSmsGiftConfirmations} />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <Mailbox className="h-4 w-4 text-[#2b4d24]" />
                    <h2 className="text-base font-bold tracking-tight text-[#1a1a1a]">Printed mail</h2>
                  </div>
                  <div className="mt-2 divide-y divide-[#e5e0d6]">
                    <ToggleRow id="mail-enabled" icon={Package} label="Direct mail" desc="Receive printed materials." checked={mailEnabled} onChange={setMailEnabled} />
                  </div>
                  <p className="mt-3 text-xs text-[#8b957b]">
                    Turning this off records a do-not-mail flag on your record in
                    Favor&rsquo;s donor database, so the mail house stops sending.
                  </p>
                  <div className="hidden">
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : saved ? <><Check className="mr-2 h-4 w-4" />Saved</> : <><Save className="mr-2 h-4 w-4" />Save preferences</>}
              </Button>
            </>
          )}

          {section === "security" && <SetPasswordCard />}


          {section === "privacy" && (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#2b4d24]" />
                    <h2 className="text-base font-bold tracking-tight text-[#1a1a1a]">Privacy</h2>
                  </div>
                  <p className="mt-2 text-sm text-[#6f7766]">
                    Favor never sells or rents your information. What you share stays between you and
                    our team. Your contact preferences live under Communications &amp; Stories; changing
                    them there is what controls every message we send.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSection("communications")}>
                      Contact preferences
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href="https://favorintl.org/legal/privacy/" target="_blank" rel="noopener noreferrer">
                        Privacy policy
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href="mailto:admin@favorintl.org?subject=My%20portal%20data">
                        Request my data
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-[#2b4d24]" />
                    <h2 className="text-base font-bold tracking-tight text-[#1a1a1a]">Need help?</h2>
                  </div>
                  <p className="mt-2 mb-4 text-sm text-[#6f7766]">
                    Our partner support team is here for you.
                  </p>
                  <ContactSupportButton />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
