"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  Globe,
  Droplets,
  BookOpen,
  Stethoscope,
  Sprout,
  Calendar,
  Share2,
  Download,
} from "lucide-react";
import Link from "next/link";
import { SectionHeader } from "@/components/portal/section-header";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import { PageBreadcrumb, PageBackButton } from "@/components/giving/page-navigation";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

// Impact metrics based on gift amounts
const IMPACT_RATES = {
  education: { perDollar: 0.1, unit: "students", icon: BookOpen, color: "#2b4d24" },
  water: { perDollar: 0.05, unit: "people with clean water", icon: Droplets, color: "#3b82f6" },
  health: { perDollar: 0.08, unit: "health screenings", icon: Stethoscope, color: "#ef4444" },
  agriculture: { perDollar: 0.06, unit: "families supported", icon: Sprout, color: "#22c55e" },
};

export default function ImpactPage() {
  const { user } = useAuth();
  const { gifts, isLoading } = useGiving(user?.id);
  const [timeRange, setTimeRange] = useState<"lifetime" | "year" | "quarter" | "month">("lifetime");

  const impactData = useMemo(() => {
    // Calculate impact based on gifts
    const now = new Date();
    let relevantGifts = gifts;

    switch (timeRange) {
      case "year":
        relevantGifts = gifts.filter((g) => new Date(g.date).getFullYear() === now.getFullYear());
        break;
      case "quarter":
        const currentQuarter = Math.floor(now.getMonth() / 3);
        relevantGifts = gifts.filter((g) => {
          const giftDate = new Date(g.date);
          return (
            giftDate.getFullYear() === now.getFullYear() &&
            Math.floor(giftDate.getMonth() / 3) === currentQuarter
          );
        });
        break;
      case "month":
        relevantGifts = gifts.filter((g) => {
          const giftDate = new Date(g.date);
          return (
            giftDate.getFullYear() === now.getFullYear() &&
            giftDate.getMonth() === now.getMonth()
          );
        });
        break;
    }

    const totalAmount = relevantGifts.reduce((sum, g) => sum + g.amount, 0);

    // Calculate impact metrics
    const educationImpact = Math.floor(totalAmount * IMPACT_RATES.education.perDollar);
    const waterImpact = Math.floor(totalAmount * IMPACT_RATES.water.perDollar);
    const healthImpact = Math.floor(totalAmount * IMPACT_RATES.health.perDollar);
    const agricultureImpact = Math.floor(totalAmount * IMPACT_RATES.agriculture.perDollar);

    // Calculate designation breakdown
    const designationBreakdown = relevantGifts.reduce((acc, gift) => {
      acc[gift.designation] = (acc[gift.designation] || 0) + gift.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAmount,
      educationImpact,
      waterImpact,
      healthImpact,
      agricultureImpact,
      designationBreakdown,
      giftCount: relevantGifts.length,
    };
  }, [gifts, timeRange]);

  function handleShare() {
    const text = `I've supported ${impactData.educationImpact} students, provided clean water to ${impactData.waterImpact} people, and funded ${impactData.healthImpact} health screenings through @FavorInternational!`;
    
    if (navigator.share) {
      navigator.share({
        title: 'My Impact with Favor International',
        text,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Impact summary copied to clipboard!");
    }
  }

  function downloadImpactReport() {
    const report = {
      donor: `${user?.firstName} ${user?.lastName}`,
      date: new Date().toLocaleDateString(),
      period: timeRange,
      totalGiven: impactData.totalAmount,
      impact: {
        studentsSupported: impactData.educationImpact,
        cleanWaterAccess: impactData.waterImpact,
        healthScreenings: impactData.healthImpact,
        familiesSupported: impactData.agricultureImpact,
      },
      gifts: impactData.giftCount,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `favor-impact-report-${timeRange}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Impact report downloaded!");
  }

  if (isLoading) {
    return <PortalPageSkeleton />;
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageBackButton href="/giving" label="Back to Giving" />
          <PageBreadcrumb items={[
            { label: "Giving", href: "/giving" },
            { label: "Impact" }
          ]} />
          <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">Your Impact</h1>
          <p className="mt-1 text-sm text-[#666666]">
            See how your generosity is transforming lives around the world.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-36">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lifetime">Lifetime</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button variant="outline" onClick={downloadImpactReport}>
            <Download className="mr-2 h-4 w-4" />
            Report
          </Button>
        </div>
      </div>

      {/* Hero Stats */}
      <Card className="bg-linear-to-br from-[#2b4d24] to-[#3d6633] text-white overflow-hidden">
        <CardContent className="p-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/60">
                Total {timeRange === "lifetime" ? "Lifetime" : timeRange} Impact
              </p>
              <h2 className="text-4xl font-bold">{formatCurrency(impactData.totalAmount)}</h2>
              <p className="text-white/70">
                Through {impactData.giftCount} {impactData.giftCount === 1 ? "gift" : "gifts"}, 
                you&apos;ve made a real difference in communities around the world.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{impactData.educationImpact.toLocaleString()}</p>
                <p className="text-xs text-white/60">Students Supported</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{impactData.waterImpact.toLocaleString()}</p>
                <p className="text-xs text-white/60">People with Clean Water</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{impactData.healthImpact.toLocaleString()}</p>
                <p className="text-xs text-white/60">Health Screenings</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{impactData.agricultureImpact.toLocaleString()}</p>
                <p className="text-xs text-white/60">Families Supported</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Impact Details Tabs */}
      <Tabs defaultValue="breakdown" className="space-y-6">
        <TabsList className="glass-pane">
          <TabsTrigger value="breakdown">Designation Breakdown</TabsTrigger>
          <TabsTrigger value="metrics">Impact Metrics</TabsTrigger>
          <TabsTrigger value="communities">Communities</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-6">
          <SectionHeader title="Where Your Gifts Go" />
          <div className="grid gap-4">
            {Object.entries(impactData.designationBreakdown)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([designation, amount]) => {
                const percentage = (amount / impactData.totalAmount) * 100;
                return (
                  <Card key={designation}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#2b4d24]/10 flex items-center justify-center">
                            <Heart className="h-5 w-5 text-[#2b4d24]" />
                          </div>
                          <div>
                            <p className="font-medium text-[#1a1a1a]">{designation}</p>
                            <p className="text-xs text-[#999999]">{percentage.toFixed(1)}% of total</p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold text-[#1a1a1a]">{formatCurrency(amount)}</p>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <SectionHeader title="Detailed Impact Metrics" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Droplets className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-2xl font-bold text-[#1a1a1a]">{impactData.waterImpact.toLocaleString()}</p>
                    <p className="text-sm text-[#666666]">People provided with clean water access</p>
                    <p className="text-xs text-[#999999] mt-2">$1 = 0.05 people with clean water</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-2xl font-bold text-[#1a1a1a]">{impactData.educationImpact.toLocaleString()}</p>
                    <p className="text-sm text-[#666666]">Students receiving educational support</p>
                    <p className="text-xs text-[#999999] mt-2">$1 = 0.1 students supported</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                    <Stethoscope className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-2xl font-bold text-[#1a1a1a]">{impactData.healthImpact.toLocaleString()}</p>
                    <p className="text-sm text-[#666666]">Health screenings provided</p>
                    <p className="text-xs text-[#999999] mt-2">$1 = 0.08 health screenings</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Sprout className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-2xl font-bold text-[#1a1a1a]">{impactData.agricultureImpact.toLocaleString()}</p>
                    <p className="text-sm text-[#666666]">Families supported through agriculture</p>
                    <p className="text-xs text-[#999999] mt-2">$1 = 0.06 families supported</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="communities" className="space-y-6">
          <SectionHeader title="Communities You've Supported" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Kigali, Rwanda", country: "Rwanda", gifts: 12, lives: 340 },
              { name: "Kampala, Uganda", country: "Uganda", gifts: 8, lives: 256 },
              { name: "Nairobi, Kenya", country: "Kenya", gifts: 15, lives: 412 },
              { name: "Dar es Salaam", country: "Tanzania", gifts: 6, lives: 189 },
            ].map((community) => (
              <Card key={community.name} className="overflow-hidden">
                <div className="h-24 bg-linear-to-br from-[#2b4d24] to-[#3d6633]" />
                <CardContent className="p-4 -mt-8">
                  <div className="rounded-full h-16 w-16 bg-white flex items-center justify-center shadow-lg mx-auto mb-3">
                    <Globe className="h-8 w-8 text-[#2b4d24]" />
                  </div>
                  <h3 className="text-center font-semibold text-[#1a1a1a]">{community.name}</h3>
                  <p className="text-center text-sm text-[#666666]">{community.country}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-[#f5f5f0] p-2">
                      <p className="text-lg font-bold text-[#2b4d24]">{community.gifts}</p>
                      <p className="text-[10px] text-[#666666]">Gifts</p>
                    </div>
                    <div className="rounded-lg bg-[#f5f5f0] p-2">
                      <p className="text-lg font-bold text-[#2b4d24]">{community.lives}</p>
                      <p className="text-[10px] text-[#666666]">Lives</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* CTA */}
      <Card className="glass-pane border-dashed">
        <CardContent className="p-8 text-center">
          <Heart className="mx-auto h-12 w-12 text-[#2b4d24] mb-4" />
          <h3 className="font-serif text-xl font-semibold text-[#1a1a1a]">Continue Making an Impact</h3>
          <p className="mt-2 text-[#666666]">
            Your generosity creates lasting change. Every gift helps transform lives and communities.
          </p>
          <Button className="mt-4 bg-[#2b4d24] hover:bg-[#1a3a15]" asChild>
            <Link href="/giving">Make a New Gift</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
