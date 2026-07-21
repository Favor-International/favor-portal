"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { formatCurrency } from "@/lib/utils";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import { FileText, Phone, Star, TrendingUp } from "lucide-react";

export default function MajorDonorPage() {
  const { user } = useAuth();
  const { totalGiven, ytdGiven, isLoading } = useGiving(user?.id);

  if (!user || user.constituentType !== "major_donor") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-gray-500">This page is only available to major donors.</p>
      </div>
    );
  }

  if (isLoading) {
    return <PortalPageSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-[#1a1a1a]">Major Donor Briefing</h1>
          <p className="text-sm text-[#666666]">
            Welcome, {user.firstName}. Your partnership fuels transformation at scale.
          </p>
        </div>
        <Badge variant="outline" className="border-[#2b4d24] text-[#2b4d24]">
          Major Donor
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Lifetime Giving</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">
              {formatCurrency(user.lifetimeGivingTotal + totalGiven)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">YTD Investment</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">
              {formatCurrency(ytdGiven)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Impact Score</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">97</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#2b4d24]" />
              Strategic Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Expansion into two new East African communities",
              "Three new leadership academies funded for 2026",
              "Improved water access for 1,200 households",
            ].map((item) => (
              <div key={item} className="rounded-xl glass-inset p-4 text-sm text-[#666666]">
                {item}
              </div>
            ))}
            <Button variant="outline" className="w-full">
              View Strategic Plan
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#2b4d24]" />
              Board-Ready Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "2025 Audited Financials",
              "Program ROI Summary",
              "Board Presentation Deck",
            ].map((doc) => (
              <div key={doc} className="flex items-center justify-between rounded-xl glass-inset p-4">
                <span className="text-sm text-[#1a1a1a]">{doc}</span>
                <Button variant="outline" size="sm">
                  Download
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-hero border border-white/15 bg-[#2b4d24]/90 text-[#FFFEF9]">
        <CardContent className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Star className="h-6 w-6 text-[#FFFEF9]" />
            <div>
              <p className="text-sm text-white/70">Your Regional Development Director</p>
              <p className="text-lg font-semibold">{user.rddAssignment ?? "Senior Partner Care"}</p>
            </div>
          </div>
          <Button className="bg-white text-[#2b4d24] hover:bg-white/90">
            <Phone className="mr-2 h-4 w-4" /> Schedule Call
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
