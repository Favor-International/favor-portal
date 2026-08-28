'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Church, Users, BookOpen, Package, Calendar, Download } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function ChurchPortalPage() {
  const { user } = useAuth();

  if (!user || user.constituentType !== 'church') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-gray-500">This page is only available to Church partners.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-serif text-3xl text-[#1a1a1a] mb-2">Church Partner Portal</h1>
          <p className="text-gray-600">Welcome, {user.firstName}. Access resources for your congregation.</p>
        </div>
        <Badge variant="outline" className="border-[#2b4d24] text-[#2b4d24]">
          Church Partner
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-600">Congregation Size</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">~500</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-600">Giving This Year</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">$5,500</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-600">Mission Sunday</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">2x/year</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-600">Partnership Length</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">4 Years</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="resources" className="w-full">
        <TabsList className="glass-subtle">
          <TabsTrigger value="resources" className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white">
            Congregation Resources
          </TabsTrigger>
          <TabsTrigger value="materials" className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white">
            Order Materials
          </TabsTrigger>
          <TabsTrigger value="events" className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white">
            Church Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resources" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-hover">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <BookOpen className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-lg text-[#1a1a1a] mb-1">Mission Sunday Toolkit</h3>
                    <p className="text-sm text-gray-600 mb-3">Everything you need for a successful mission Sunday presentation</p>
                    <Button variant="outline" size="sm">Download Toolkit</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-hover">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <Users className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-lg text-[#1a1a1a] mb-1">Small Group Studies</h3>
                    <p className="text-sm text-gray-600 mb-3">4-week curriculum on global missions and Favor&apos;s work</p>
                    <Button variant="outline" size="sm">Access Studies</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-hover">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <Church className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-lg text-[#1a1a1a] mb-1">Prayer Guide</h3>
                    <p className="text-sm text-gray-600 mb-3">Monthly prayer requests from our African ministries</p>
                    <Button variant="outline" size="sm">Download Guide</Button>
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
                    <h3 className="font-serif text-lg text-[#1a1a1a] mb-1">Videos & Media</h3>
                    <p className="text-sm text-gray-600 mb-3">Downloadable videos for services and presentations</p>
                    <Button variant="outline" size="sm">Browse Media</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="materials" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">Order Materials</CardTitle>
              <CardDescription>Request free materials for your congregation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'Favor Brochures', description: 'Pack of 50 informational brochures', icon: Package },
                  { name: 'Prayer Cards', description: 'Set of 25 prayer cards with photos', icon: Package },
                  { name: 'Annual Report', description: 'Printed copies for your congregation', icon: Package },
                  { name: 'Kids Activity Book', description: 'Educational activities about Africa', icon: Package },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg glass-inset glass-transition">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-[#2b4d24]/10 rounded">
                        <item.icon className="h-5 w-5 text-[#2b4d24]" />
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                    </div>
                    <Button size="sm">Request</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-xl">Upcoming Church Events</CardTitle>
              <CardDescription>Special events for church partners</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { title: 'Pastors Mission Trip', date: 'March 15-22, 2025', location: 'Uganda' },
                  { title: 'Church Partners Conference', date: 'June 20, 2025', location: 'Virtual' },
                  { title: 'Youth Mission Experience', date: 'July 10-20, 2025', location: 'Kenya' },
                ].map((event, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-lg glass-inset glass-transition">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-[#2b4d24]/10 rounded">
                        <Calendar className="h-5 w-5 text-[#2b4d24]" />
                      </div>
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-gray-600">{event.date} • {event.location}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Learn More</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
