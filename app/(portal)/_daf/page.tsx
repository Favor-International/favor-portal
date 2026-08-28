'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Wallet, 
  FileText, 
  TrendingUp, 
  Gift, 
  Building2,
  ArrowRight,
  Download,
  Info
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useGiving } from '@/hooks/use-giving';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function DafDashboardPage() {
  const { user } = useAuth();
  const { gifts, isLoading, totalGiven, ytdGiven } = useGiving(user?.id);

  if (!user || user.constituentType !== 'daf') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-gray-500">This page is only available to DAF Donor partners.</p>
      </div>
    );
  }

  // Filter DAF grants from gifts
  const dafGifts = gifts.filter(g => g.designation.toLowerCase().includes('daf'));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-sans tracking-tight text-3xl font-semibold text-[#1a1a1a] mb-2">
            DAF Donor Portal
          </h1>
          <p className="text-[#666666]">
            Welcome, {user.firstName}. Manage your Donor-Advised Fund grants.
          </p>
        </div>
        <Badge variant="outline" className="border-[#2b4d24] text-[#2b4d24]">
          DAF Partner
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Lifetime DAF Grants</CardDescription>
            <CardTitle className="font-sans tracking-tight text-3xl text-[#2b4d24]">
              {formatCurrency(totalGiven)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">YTD Grants</CardDescription>
            <CardTitle className="font-sans tracking-tight text-3xl text-[#2b4d24]">
              {formatCurrency(ytdGiven)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Total Grants</CardDescription>
            <CardTitle className="font-sans tracking-tight text-3xl text-[#2b4d24]">
              {dafGifts.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Avg Grant Size</CardDescription>
            <CardTitle className="font-sans tracking-tight text-3xl text-[#2b4d24]">
              {dafGifts.length > 0 
                ? formatCurrency(totalGiven / dafGifts.length) 
                : formatCurrency(0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="grants" className="w-full">
        <TabsList className="glass-subtle">
          <TabsTrigger 
            value="grants" 
            className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white"
          >
            Grant History
          </TabsTrigger>
          <TabsTrigger 
            value="recommend" 
            className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white"
          >
            Recommend a Grant
          </TabsTrigger>
          <TabsTrigger 
            value="resources" 
            className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white"
          >
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grants" className="mt-6">
          {isLoading ? (
            <div className="space-y-3" aria-hidden="true">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : dafGifts.length === 0 ? (
            <Card className="p-8 text-center">
              <Wallet className="mx-auto h-12 w-12 text-[#e5e5e0] mb-4" />
              <p className="text-[#666666]">No DAF grants found yet.</p>
              <p className="text-sm text-[#999999] mt-2">
                Your grant history will appear here once you make your first DAF grant.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {dafGifts.map((gift) => (
                <Card key={gift.id} className="glass-hover">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#2b4d24]/10 rounded-lg">
                          <Gift className="h-5 w-5 text-[#2b4d24]" />
                        </div>
                        <div>
                          <h3 className="font-sans tracking-tight text-xl text-[#1a1a1a]">
                            {gift.designation}
                          </h3>
                          <p className="text-sm text-[#666666]">{formatDate(gift.date)}</p>
                        </div>
                      </div>
                      <p className="text-2xl font-sans tracking-tight font-semibold text-[#2b4d24]">
                        {formatCurrency(gift.amount)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recommend" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-sans tracking-tight text-xl text-[#1a1a1a]">
                Recommend a Grant to Favor International
              </CardTitle>
              <CardDescription className="text-[#666666]">
                Support our mission through your Donor-Advised Fund
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="glass-inset p-4 rounded-lg">
                <h4 className="font-medium text-[#1a1a1a] mb-2">Our Organization Information</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="text-[#666666]">Legal Name:</span> Favor International, Inc.</p>
                  <p><span className="text-[#666666]">EIN:</span> 83-2184327</p>
                  <p><span className="text-[#666666]">Address:</span> 3433 Lithia Pinecrest Rd #356, Valrico, FL 33596</p>
                  <p><span className="text-[#666666]">501(c)(3) Status:</span> Active</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-[#1a1a1a]">Popular DAF Providers</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Fidelity Charitable', 'Schwab Charitable', 'Vanguard Charitable', 'National Philanthropic'].map((provider) => (
                    <Button key={provider} variant="outline" className="w-full text-sm">
                      {provider}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="glass-inset border border-[#2b4d24]/20 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-[#2b4d24] mt-0.5" />
                  <div>
                    <p className="font-medium text-[#1a1a1a] mb-1">Need Help?</p>
                    <p className="text-sm text-[#666666]">
                      Contact your Regional Development Director or email us at giving@favorintl.org 
                      for assistance with your DAF grant recommendation.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-hover cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <FileText className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-sans tracking-tight text-lg font-semibold text-[#1a1a1a] mb-1">
                      Annual Report
                    </h3>
                    <p className="text-sm text-[#666666] mb-3">
                      Comprehensive overview of our programs and financials
                    </p>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" /> Download PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-hover cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-sans tracking-tight text-lg font-semibold text-[#1a1a1a] mb-1">
                      Impact Dashboard
                    </h3>
                    <p className="text-sm text-[#666666] mb-3">
                      See how DAF grants are transforming communities
                    </p>
                    <Button variant="outline" size="sm" className="gap-2">
                      View Impact <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-hover cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <Building2 className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-sans tracking-tight text-lg font-semibold text-[#1a1a1a] mb-1">
                      DAF Grant Guidelines
                    </h3>
                    <p className="text-sm text-[#666666] mb-3">
                      Learn about making grants from your donor-advised fund
                    </p>
                    <Button variant="outline" size="sm">
                      Read More
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-hover cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <Gift className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-sans tracking-tight text-lg font-semibold text-[#1a1a1a] mb-1">
                      Legacy Giving Guide
                    </h3>
                    <p className="text-sm text-[#666666] mb-3">
                      Explore planned giving options for lasting impact
                    </p>
                    <Button variant="outline" size="sm">
                      Learn More
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
