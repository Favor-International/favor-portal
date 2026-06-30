"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Phone, Edit, Camera, Heart, Save, Check, X,
  Sparkles, GraduationCap, CalendarDays, ArrowRight, UserRound,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { getGivingTier } from "@/lib/constants";
import { ContactSupportDialog } from "@/components/portal/contact-support-dialog";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";

export default function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth();
  const { totalGiven, ytdGiven, gifts } = useGiving(user?.id);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});

  const val = (key: string, fallback = "") => form[key] ?? fallback;

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }
    const activeUser = user;
    let cancelled = false;
    setProfileLoading(true);

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load profile");
        const payload = (await response.json()) as { profile?: Record<string, string> };
        if (!cancelled && payload.profile) {
          setForm({
            firstName: payload.profile.firstName ?? activeUser.firstName,
            lastName: payload.profile.lastName ?? activeUser.lastName,
            email: payload.profile.email ?? activeUser.email,
            phone: payload.profile.phone ?? activeUser.phone ?? "",
            street: payload.profile.street ?? "",
            city: payload.profile.city ?? "",
            state: payload.profile.state ?? "",
            zip: payload.profile.zip ?? "",
          });
        }
      } catch {
        if (!cancelled) {
          toast.error("Unable to load profile details");
          setForm({
            firstName: activeUser.firstName,
            lastName: activeUser.lastName,
            email: activeUser.email,
            phone: activeUser.phone ?? "",
            street: "", city: "", state: "", zip: "",
          });
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => { cancelled = true; };
  }, [user]);

  if (isLoading || profileLoading) return <PortalPageSkeleton />;

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : "??";
  const lifetime = Math.max(user?.lifetimeGivingTotal ?? 0, totalGiven);
  const tier = getGivingTier(lifetime);
  const memberSince = user?.createdAt ? new Date(user.createdAt).getFullYear() : null;
  const cityState = [val("city"), val("state")].filter(Boolean).join(", ");
  const addressLine = [val("street"), cityState, val("zip")].filter(Boolean).join(" · ");

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: val("firstName", user.firstName),
          lastName: val("lastName", user.lastName),
          email: val("email", user.email),
          phone: val("phone", user.phone ?? ""),
          street: val("street"), city: val("city"), state: val("state"), zip: val("zip"),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to save profile");
      }
      const payload = (await response.json()) as { profile?: Record<string, string> };
      if (payload.profile) {
        setForm((prev) => ({ ...prev, ...payload.profile }));
      }
      await refreshUser();
      setSaving(false);
      setSaved(true);
      setEditing(false);
      toast.success("Profile updated");
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaving(false);
      toast.error(error instanceof Error ? error.message : "Unable to save profile");
    }
  }

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-1 text-xs text-[#8b957b]">
        <Link href="/dashboard" className="hover:text-[#2b4d24]">Home</Link>
        <span>/</span>
        <span className="font-medium text-[#2b4d24]">Profile</span>
      </nav>

      {/* Identity hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10">
        <Image src="/brand/hero-pastor-preaching.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(110deg, rgba(31,58,26,0.95) 0%, rgba(31,58,26,0.82) 50%, rgba(31,58,26,0.55) 100%)" }}
        />
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20 ring-2 ring-white/30">
                <AvatarImage src={user?.avatarUrl} />
                <AvatarFallback className="bg-[#e1a730] text-[#1a1a1a] text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <button
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#2b4d24] shadow-md transition hover:bg-white/90"
                onClick={() => toast.info("Photo upload coming soon")}
                aria-label="Upload profile photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {user?.firstName} {user?.lastName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="border-0 bg-[#e1a730] text-[#1a1a1a]">{tier.name}</Badge>
                {memberSince && (
                  <span className="text-sm text-white/80">Partner since {memberSince}</span>
                )}
              </div>
            </div>
          </div>
          <Button className="bg-white text-[#2b4d24] hover:bg-white/90" asChild>
            <Link href="/giving/impact"><Sparkles className="mr-2 h-4 w-4" />Your impact</Link>
          </Button>
        </div>
      </section>

      {/* Bento grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Impact snapshot */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-[#a36d4c]">
              <Sparkles className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Your partnership</span>
            </div>
            <p className="mt-3 text-4xl font-extrabold tracking-tight text-[#2b4d24]">
              {formatCurrency(lifetime)}
            </p>
            <p className="mt-1 max-w-md text-sm text-[#6f7766]">
              Given over your lifetime as a partner — helping train indigenous leaders and bring
              the gospel where others will not go.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { icon: CalendarDays, label: "This year", value: formatCurrency(ytdGiven) },
                { icon: Heart, label: "Gifts", value: String(gifts.length || 0) },
                { icon: GraduationCap, label: "Tier", value: tier.name.replace(" Partner", "") },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-[#faf7f1] p-3.5">
                  <s.icon className="h-4 w-4 text-[#2b4d24]" />
                  <p className="mt-1.5 text-lg font-bold text-[#1a1a1a]">{s.value}</p>
                  <p className="text-xs text-[#8b957b]">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Your RDD */}
        <Card>
          <CardContent className="flex h-full flex-col p-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a36d4c]">
              Your contact
            </span>
            {user?.rddAssignment ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-[#2b4d24] text-[#FFFEF9] font-semibold">
                      {user.rddAssignment.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-[#1a1a1a]">{user.rddAssignment}</p>
                    <p className="text-xs text-[#8b957b]">Regional Development Director</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#6f7766]">
                  Here to help with anything you need as a Favor partner.
                </p>
                <div className="mt-auto flex gap-2 pt-4">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <a href="mailto:partners@favorintl.org"><Mail className="mr-1.5 h-3.5 w-3.5" />Email</a>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <a href="tel:+18005550100"><Phone className="mr-1.5 h-3.5 w-3.5" />Call</a>
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-1 flex-col items-start justify-center">
                <UserRound className="h-8 w-8 text-[#c5ccc2]" />
                <p className="mt-2 text-sm text-[#6f7766]">
                  A dedicated partner contact will be assigned to you soon.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile details (read-first, inline edit) */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-[#1a1a1a]">Personal details</h2>
              {!editing && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit className="mr-1.5 h-3.5 w-3.5" />Edit
                </Button>
              )}
            </div>

            {!editing ? (
              <dl className="mt-5 divide-y divide-[#e5e0d6]">
                {[
                  { label: "Name", value: `${val("firstName", user?.firstName)} ${val("lastName", user?.lastName)}` },
                  { label: "Email", value: val("email", user?.email) },
                  { label: "Phone", value: val("phone") || "Not added" },
                  { label: "Mailing address", value: addressLine || "Not added" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 py-3.5">
                    <dt className="text-sm text-[#8b957b]">{row.label}</dt>
                    <dd className="text-right text-sm font-medium text-[#1a1a1a]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-first-name">First name</Label>
                    <Input id="profile-first-name" value={val("firstName", user?.firstName)} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-last-name">Last name</Label>
                    <Input id="profile-last-name" value={val("lastName", user?.lastName)} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input id="profile-email" type="email" value={val("email", user?.email)} disabled />
                  <p className="text-xs text-[#8b957b]">Email is managed by your login method.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-phone">Phone</Label>
                  <Input id="profile-phone" type="tel" value={val("phone")} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Add phone number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-street">Mailing address</Label>
                  <Input id="profile-street" placeholder="Street address" value={val("street")} onChange={(e) => setForm({ ...form, street: e.target.value })} />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input id="profile-city" placeholder="City" value={val("city")} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    <Input id="profile-state" placeholder="State" value={val("state")} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                    <Input id="profile-zip" placeholder="ZIP" value={val("zip")} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : saved ? <><Check className="mr-2 h-4 w-4" />Saved</> : <><Save className="mr-2 h-4 w-4" />Save changes</>}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>
                    <X className="mr-1.5 h-3.5 w-3.5" />Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid gap-5">
          <Link href="/settings" className="group">
            <Card className="glass-transition glass-hover h-full">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="font-semibold text-[#1a1a1a]">Communications &amp; stories</p>
                  <p className="text-xs text-[#8b957b]">Email, SMS, and mail preferences</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#2b4d24] transition group-hover:translate-x-0.5" />
              </CardContent>
            </Card>
          </Link>
          <Card className="h-full">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="font-semibold text-[#1a1a1a]">Need help?</p>
                <p className="text-xs text-[#8b957b]">Reach our partner support team</p>
              </div>
              <ContactSupportDialog trigger={<Button variant="outline" size="sm">Contact</Button>} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
