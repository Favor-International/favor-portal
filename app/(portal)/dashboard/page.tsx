"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Calendar, Receipt, ArrowRight, UserCog, History } from "lucide-react";
import { RecurringManager } from "@/components/giving/recurring-manager";
import { FromTheField } from "@/components/giving/from-the-field";
import { giveUrl } from "@/lib/give-links";
import { DashboardSkeleton } from "@/components/portal/dashboard/dashboard-skeleton";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { user, isLoading: userLoading } = useAuth();
  const { totalGiven, ytdGiven, gifts, isLoading: givingLoading } = useGiving(user?.id);

  if (userLoading || givingLoading) {
    return <DashboardSkeleton />;
  }

  const lifetime = Math.max(user?.lifetimeGivingTotal ?? 0, totalGiven);

  const stats = [
    { label: "Lifetime giving", value: formatCurrency(lifetime), icon: Heart },
    { label: "This year", value: formatCurrency(ytdGiven), icon: Calendar },
    { label: "Gifts recorded", value: String(gifts.length), icon: Receipt },
  ];

  const quickActions = [
    {
      label: "Give a one-time gift",
      desc: "A single secure gift to the field",
      href: giveUrl("once"),
      external: true,
      icon: Heart,
    },
    { label: "Giving history", desc: "Every gift and receipt", href: "/giving/history", external: false, icon: History },
    { label: "Update profile", desc: "Your details and preferences", href: "/profile", external: false, icon: UserCog },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
        </h1>
        <p className="mt-1 text-sm text-[#6f7766]">
          Your giving home. Manage your partnership, see your history, and follow the field.
        </p>
      </header>

      {/* Giving summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2b4d24]/5">
                <s.icon className="h-5 w-5 text-[#2b4d24]" />
              </div>
              <div>
                <p className="text-xs text-[#8b957b]">{s.label}</p>
                <p className="text-xl font-semibold text-[#1a1a1a]">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Monthly partnership: management, or the push to start one */}
          <RecurringManager />

          {/* Quick actions */}
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
              {quickActions.map((a) =>
                a.external ? (
                  <a
                    key={a.label}
                    href={a.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col gap-1 rounded-xl border border-[#e5e0d6] p-4 transition hover:border-[#e1a730] hover:bg-[#fffdf7]"
                  >
                    <a.icon className="h-5 w-5 text-[#2b4d24]" />
                    <span className="mt-1 text-sm font-semibold text-[#1a1a1a]">{a.label}</span>
                    <span className="text-xs text-[#6f7766]">{a.desc}</span>
                  </a>
                ) : (
                  <Link
                    key={a.label}
                    href={a.href}
                    className="group flex flex-col gap-1 rounded-xl border border-[#e5e0d6] p-4 transition hover:border-[#e1a730] hover:bg-[#fffdf7]"
                  >
                    <a.icon className="h-5 w-5 text-[#2b4d24]" />
                    <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-[#1a1a1a]">
                      {a.label}
                      <ArrowRight className="h-3.5 w-3.5 text-[#a8b0a0] transition group-hover:translate-x-0.5 group-hover:text-[#2b4d24]" />
                    </span>
                    <span className="text-xs text-[#6f7766]">{a.desc}</span>
                  </Link>
                )
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <FromTheField />
        </div>
      </div>
    </div>
  );
}
