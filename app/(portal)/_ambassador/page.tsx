'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Trophy, 
  Target, 
  Calendar, 
  Share2,
  Megaphone,
  TrendingUp,
  Award,
  Download,
  Mail,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useGiving } from '@/hooks/use-giving';
import { formatCurrency } from '@/lib/utils';

export default function AmbassadorDashboardPage() {
  const { user } = useAuth();
  const { totalGiven } = useGiving(user?.id);

  if (!user || user.constituentType !== 'ambassador') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-gray-500">This page is only available to Ambassador partners.</p>
      </div>
    );
  }

  // Calculate ambassador-specific metrics (using mock data for now)
  const fundsRaised = totalGiven + 15000; // Include funds raised from others
  const networkSize = 24;
  const eventsHosted = 3;
  const referralsMade = 8;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-sans tracking-tight text-3xl font-semibold text-[#1a1a1a] mb-2">
            Ambassador Portal
          </h1>
          <p className="text-[#666666]">
            Welcome back, {user.firstName}! Your advocacy makes a difference.
          </p>
        </div>
        <Badge variant="outline" className="border-[#2b4d24] text-[#2b4d24]">
          Ambassador Partner
        </Badge>
      </div>

      {/* Impact Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-hero border border-white/15 bg-[#2b4d24]/90 text-[#FFFEF9]">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#FFFEF9]/70">Total Funds Raised</CardDescription>
            <CardTitle className="font-sans tracking-tight text-3xl text-[#FFFEF9]">
              {formatCurrency(fundsRaised)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Network Size</CardDescription>
            <CardTitle className="font-sans tracking-tight text-3xl text-[#2b4d24]">
              {networkSize}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Events Hosted</CardDescription>
            <CardTitle className="font-sans tracking-tight text-3xl text-[#2b4d24]">
              {eventsHosted}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Referrals</CardDescription>
            <CardTitle className="font-sans tracking-tight text-3xl text-[#2b4d24]">
              {referralsMade}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="glass-subtle">
          <TabsTrigger 
            value="dashboard" 
            className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white"
          >
            Dashboard
          </TabsTrigger>
          <TabsTrigger 
            value="tools" 
            className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white"
          >
            Advocacy Tools
          </TabsTrigger>
          <TabsTrigger 
            value="events" 
            className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white"
          >
            Events
          </TabsTrigger>
          <TabsTrigger 
            value="recognition" 
            className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white"
          >
            Recognition
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Goals */}
            <Card>
              <CardHeader>
                <CardTitle className="font-sans tracking-tight text-xl text-[#1a1a1a] flex items-center gap-2">
                  <Target className="h-5 w-5 text-[#2b4d24]" />
                  Monthly Goals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-[#666666]">Funds Raised</span>
                    <span className="text-sm font-medium text-[#1a1a1a]">$3,500 / $5,000</span>
                  </div>
                  <Progress value={70} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-[#666666]">New Supporters</span>
                    <span className="text-sm font-medium text-[#1a1a1a]">4 / 5</span>
                  </div>
                  <Progress value={80} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-[#666666]">Event Registrations</span>
                    <span className="text-sm font-medium text-[#1a1a1a]">12 / 20</span>
                  </div>
                  <Progress value={60} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="font-sans tracking-tight text-xl text-[#1a1a1a] flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#2b4d24]" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg glass-inset glass-transition">
                    <div className="p-2 bg-[#2b4d24]/10 rounded-full">
                      <Users className="h-4 w-4 text-[#2b4d24]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1a1a1a]">New supporter joined</p>
                      <p className="text-xs text-[#666666]">Sarah M. joined through your link</p>
                    </div>
                    <span className="text-xs text-[#999999]">2h ago</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg glass-inset glass-transition">
                    <div className="p-2 bg-[#2b4d24]/10 rounded-full">
                      <Trophy className="h-4 w-4 text-[#2b4d24]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1a1a1a]">$500 gift received</p>
                      <p className="text-xs text-[#666666]">From your Spring Dinner event</p>
                    </div>
                    <span className="text-xs text-[#999999]">1d ago</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg glass-inset glass-transition">
                    <div className="p-2 bg-[#2b4d24]/10 rounded-full">
                      <Share2 className="h-4 w-4 text-[#2b4d24]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1a1a1a]">Social share milestone</p>
                      <p className="text-xs text-[#666666]">Your post reached 150 people</p>
                    </div>
                    <span className="text-xs text-[#999999]">3d ago</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tools" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-hover">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <Share2 className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-sans tracking-tight text-lg font-semibold text-[#1a1a1a] mb-1">
                      Share Your Link
                    </h3>
                    <p className="text-sm text-[#666666] mb-3">
                      Share your personal referral link with friends and family
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Copy Link
                      </Button>
                      <Button size="sm" className="bg-[#2b4d24] hover:bg-[#1a3a15]">
                        Share
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-hover">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <Download className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-sans tracking-tight text-lg font-semibold text-[#1a1a1a] mb-1">
                      Download Resources
                    </h3>
                    <p className="text-sm text-[#666666] mb-3">
                      One-pagers, videos, and presentation materials
                    </p>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" /> Browse Materials
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-hover">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <Mail className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-sans tracking-tight text-lg font-semibold text-[#1a1a1a] mb-1">
                      Email Templates
                    </h3>
                    <p className="text-sm text-[#666666] mb-3">
                      Pre-written emails to share our mission
                    </p>
                    <Button variant="outline" size="sm">
                      View Templates
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-hover">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <Megaphone className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-sans tracking-tight text-lg font-semibold text-[#1a1a1a] mb-1">
                      Social Media Kit
                    </h3>
                    <p className="text-sm text-[#666666] mb-3">
                      Graphics and captions for your social channels
                    </p>
                    <Button variant="outline" size="sm">
                      Get Content
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <div className="space-y-4">
            <Card className="glass-hover cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                      <Calendar className="h-6 w-6 text-[#2b4d24]" />
                    </div>
                    <div>
                      <h3 className="font-sans tracking-tight text-lg font-semibold text-[#1a1a1a] mb-1">
                        Spring Fundraising Dinner
                      </h3>
                      <p className="text-sm text-[#666666]">March 15, 2025 • 6:00 PM</p>
                      <p className="text-sm text-[#666666]">Your Home • 12 guests invited</p>
                      <div className="flex gap-2 mt-3">
                        <Badge variant="outline" className="text-xs">Planning</Badge>
                        <Badge variant="outline" className="text-xs">Goal: $2,500</Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-sans tracking-tight text-xl text-[#1a1a1a] flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[#2b4d24]" />
                  Host an Event
                </CardTitle>
                <CardDescription className="text-[#666666]">
                  Bring your community together to support Favor International
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg text-center glass-inset glass-transition">
                    <Users className="h-8 w-8 text-[#2b4d24] mx-auto mb-2" />
                    <p className="font-medium text-[#1a1a1a]">Dinner Party</p>
                    <p className="text-xs text-[#666666]">Intimate gathering</p>
                  </div>
                  <div className="p-4 rounded-lg text-center glass-inset glass-transition">
                    <Share2 className="h-8 w-8 text-[#2b4d24] mx-auto mb-2" />
                    <p className="font-medium text-[#1a1a1a]">Online Event</p>
                    <p className="text-xs text-[#666666]">Virtual meetup</p>
                  </div>
                  <div className="p-4 rounded-lg text-center glass-inset glass-transition">
                    <Trophy className="h-8 w-8 text-[#2b4d24] mx-auto mb-2" />
                    <p className="font-medium text-[#1a1a1a]">Activity Event</p>
                    <p className="text-xs text-[#666666]">Run, ride, etc.</p>
                  </div>
                </div>
                <Button className="w-full mt-4 bg-[#2b4d24] hover:bg-[#1a3a15]">
                  Plan Your Event <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recognition" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-pane border border-[#b08b3e]/30 bg-[#b08b3e]/10">
              <CardHeader>
                <CardTitle className="font-sans tracking-tight text-xl text-[#1a1a1a] flex items-center gap-2">
                  <Award className="h-5 w-5 text-[#FFD700]" />
                  Your Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg glass-inset glass-transition">
                    <Trophy className="h-8 w-8 text-[#FFD700]" />
                    <div>
                      <p className="font-medium text-[#1a1a1a]">Champion Ambassador</p>
                      <p className="text-xs text-[#666666]">Raised $10,000+ in 2024</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg glass-inset glass-transition">
                    <Users className="h-8 w-8 text-[#C0C0C0]" />
                    <div>
                      <p className="font-medium text-[#1a1a1a]">Network Builder</p>
                      <p className="text-xs text-[#666666]">Connected 20+ supporters</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg glass-inset glass-transition">
                    <Calendar className="h-8 w-8 text-[#CD7F32]" />
                    <div>
                      <p className="font-medium text-[#1a1a1a]">Event Host</p>
                      <p className="text-xs text-[#666666]">Hosted 3 successful events</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-sans tracking-tight text-xl text-[#1a1a1a]">
                  Ambassador Leaderboard
                </CardTitle>
                <CardDescription className="text-[#666666]">
                  Top ambassadors this quarter
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-[#FFD700]/10 rounded-lg border border-[#FFD700]/30">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#FFD700]">1</span>
                      <div>
                        <p className="font-medium text-[#1a1a1a]">Jennifer L.</p>
                        <p className="text-xs text-[#666666]">Denver, CO</p>
                      </div>
                    </div>
                    <span className="font-semibold text-[#2b4d24]">$25,400</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#C0C0C0]/10 rounded-lg border border-[#C0C0C0]/30">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#C0C0C0]">2</span>
                      <div>
                        <p className="font-medium text-[#1a1a1a]">Michael R.</p>
                        <p className="text-xs text-[#666666]">Austin, TX</p>
                      </div>
                    </div>
                    <span className="font-semibold text-[#2b4d24]">$18,200</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#CD7F32]/10 rounded-lg border border-[#CD7F32]/30">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#CD7F32]">3</span>
                      <div>
                        <p className="font-medium text-[#1a1a1a]">You</p>
                        <p className="text-xs text-[#666666]">{user.rddAssignment?.split(' - ')[0] || 'Your Region'}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-[#2b4d24]">$15,000</span>
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
