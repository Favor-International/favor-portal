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
  Newspaper, CalendarDays, ReceiptText, Smartphone, Package, HelpCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ContactSupportDialog } from "@/components/portal/contact-support-dialog";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";

type SectionId = "communications" | "reports" | "privacy";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "communications", label: "Communications & Stories", icon: Mail },
  { id: "reports", label: "Impact Reports", icon: FileBarChart },
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

  const [emailNewsletter, setEmailNewsletter] = useState(true);
  const [emailEvents, setEmailEvents] = useState(true);
  const [emailGiving, setEmailGiving] = useState(true);
  const [emailReports, setEmailReports] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsGiftConfirmations, setSmsGiftConfirmations] = useState(false);
  const [mailEnabled, setMailEnabled] = useState(true);
  const [mailAnnualReport, setMailAnnualReport] = useState(true);
  const [reportPeriod, setReportPeriod] = useState("quarterly");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!preferences) return;
    setEmailNewsletter(preferences.emailNewsletterMonthly);
    setEmailEvents(preferences.emailEvents);
    setEmailGiving(preferences.emailGivingConfirmations);
    setEmailReports(preferences.emailQuarterlyReport || preferences.emailAnnualReport);
    setSmsEnabled(preferences.smsEnabled);
    setSmsGiftConfirmations(preferences.smsGiftConfirmations);
    setMailEnabled(preferences.mailEnabled);
    setMailAnnualReport(preferences.mailAnnualReport);
    setReportPeriod(preferences.reportPeriod);
  }, [preferences]);

  async function handleSave() {
    setSaving(true);
    try {
      await updatePreferences({
        emailNewsletterMonthly: emailNewsletter,
        emailEvents,
        emailGivingConfirmations: emailGiving,
        emailQuarterlyReport: emailReports,
        emailAnnualReport: emailReports,
        smsEnabled,
        smsGiftConfirmations,
        mailEnabled,
        mailAnnualReport,
        reportPeriod: reportPeriod === "annual" ? "annual" : "quarterly",
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

  function downloadReport() {
    const label = reportPeriod === "quarterly" ? "Q4 2025" : "Annual 2025";
    const text = [
      `FAVOR INTERNATIONAL - ${label} IMPACT REPORT`,
      "=".repeat(50), "",
      "Summary", "-------",
      "Communities Served: 12", "Countries Reached: 4", "Lives Impacted: 1,247",
      "Clean Water Wells: 3", "Students Sponsored: 89", "",
      "Financial Overview", "------------------",
      "Total Revenue: $1,245,000", "Program Expenses: $1,020,000 (82%)",
      "Administrative: $150,000 (12%)", "Fundraising: $75,000 (6%)", "",
      "Favor International, Inc.", '"Transformed Hearts Transform Nations"',
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `favor-${reportPeriod}-report-2025.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${label} report downloaded`);
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
                    <ToggleRow id="reports" icon={FileBarChart} label="Impact reports" desc="Quarterly and annual impact reports." checked={emailReports} onChange={setEmailReports} />
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
                    {mailEnabled && (
                      <ToggleRow id="mail-annual" icon={FileBarChart} label="Printed annual report" desc="The full-year impact report by mail." checked={mailAnnualReport} onChange={setMailAnnualReport} />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : saved ? <><Check className="mr-2 h-4 w-4" />Saved</> : <><Save className="mr-2 h-4 w-4" />Save preferences</>}
              </Button>
            </>
          )}

          {section === "reports" && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <FileBarChart className="h-4 w-4 text-[#2b4d24]" />
                  <h2 className="text-base font-bold tracking-tight text-[#1a1a1a]">Impact reports</h2>
                </div>
                <p className="mt-1 text-sm text-[#6f7766]">
                  See the difference your partnership is making. Choose a period and download the report.
                </p>
                <div className="mt-5 max-w-xs space-y-2">
                  <label htmlFor="report-period" className="text-xs font-medium text-[#8b957b]">Report period</label>
                  <Select value={reportPeriod} onValueChange={setReportPeriod}>
                    <SelectTrigger id="report-period"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-3 text-xs text-[#8b957b]">
                  {reportPeriod === "quarterly"
                    ? "Showing Q4 2025 impact data. Switch to annual for the full year."
                    : "Showing full-year 2025 impact data."}
                </p>
                <Button className="mt-5" onClick={downloadReport}>
                  <Download className="mr-2 h-4 w-4" />
                  Download {reportPeriod === "quarterly" ? "Q4" : "annual"} report
                </Button>
              </CardContent>
            </Card>
          )}

          {section === "privacy" && (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#2b4d24]" />
                    <h2 className="text-base font-bold tracking-tight text-[#1a1a1a]">Privacy</h2>
                  </div>
                  <p className="mt-2 text-sm text-[#6f7766]">
                    Your preferences are stored securely. Changes may take up to 24 hours to propagate
                    across all systems.
                  </p>
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
                  <ContactSupportDialog />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
