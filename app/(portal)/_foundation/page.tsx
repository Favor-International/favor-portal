'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useGrants } from '@/hooks/use-grants';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function FoundationDashboardPage() {
  const { user } = useAuth();
  const { grants, isLoading, totalGranted, activeGrants } = useGrants(user?.id);

  if (!user || user.constituentType !== 'foundation') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-gray-500">This page is only available to Foundation partners.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-serif text-3xl text-[#1a1a1a] mb-2">Foundation Portal</h1>
          <p className="text-gray-600">Welcome, {user.firstName}. Manage your grants and track impact.</p>
        </div>
        <Badge variant="outline" className="border-[#2b4d24] text-[#2b4d24]">
          Foundation Partner
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-600">Total Granted</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">{formatCurrency(totalGranted)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-600">Active Grants</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">{activeGrants}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-600">Years Partnered</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">3+</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="grants" className="w-full">
        <TabsList className="glass-subtle">
          <TabsTrigger value="grants" className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white">
            Grant Portfolio
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white">
            Impact Reports
          </TabsTrigger>
          <TabsTrigger value="resources" className="data-[state=active]:bg-[#2b4d24] data-[state=active]:text-white">
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
          ) : grants.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500">No grants found.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {grants.map((grant) => (
                <Card key={grant.id} className="glass-hover">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-serif text-xl text-[#1a1a1a] mb-1">{grant.grantName}</h3>
                        <p className="text-sm text-gray-500">{formatDate(grant.startDate)} - {grant.endDate ? formatDate(grant.endDate) : 'Ongoing'}</p>
                      </div>
                      <Badge 
                        className={
                          grant.status === 'active' ? 'bg-[#2b4d24] text-white' :
                          grant.status === 'completed' ? 'bg-gray-500' :
                          'bg-yellow-500'
                        }
                      >
                        {grant.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-2xl font-serif text-[#2b4d24]">{formatCurrency(grant.amount)}</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">View Details</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="font-serif">{grant.grantName}</DialogTitle>
                            <DialogDescription>Grant details and reporting requirements</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-gray-500">Amount</p>
                                <p className="text-lg font-medium">{formatCurrency(grant.amount)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Status</p>
                                <Badge className={grant.status === 'active' ? 'bg-[#2b4d24]' : 'bg-gray-500'}>
                                  {grant.status}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Start Date</p>
                                <p>{formatDate(grant.startDate)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">End Date</p>
                                <p>{grant.endDate ? formatDate(grant.endDate) : 'Ongoing'}</p>
                              </div>
                            </div>
                            {grant.nextReportDue && (
                              <div className="glass-inset border border-[#b08b3e]/25 p-4 rounded-lg">
                                <p className="text-sm font-medium text-[#7d6330]">
                                  Next Report Due: {formatDate(grant.nextReportDue)}
                                </p>
                              </div>
                            )}
                            {grant.notes && (
                              <div>
                                <p className="text-sm text-gray-500 mb-1">Notes</p>
                                <p className="text-sm">{grant.notes}</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-xl">Available Reports</CardTitle>
                <CardDescription>Download formal impact reports and financial statements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['2024 Annual Impact Report', 'Q4 2024 Financial Summary', 'Education Program Outcomes 2024', 'Healthcare Initiative Report'].map((report, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg glass-inset glass-transition">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-[#2b4d24]" />
                        <span className="font-medium">{report}</span>
                      </div>
                      <Button variant="outline" size="sm">Download PDF</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-hover cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#2b4d24]/10 rounded-lg">
                    <FileText className="h-6 w-6 text-[#2b4d24]" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg text-[#1a1a1a] mb-1">Grant Application Template</h3>
                    <p className="text-sm text-gray-600">Standard template for future grant applications</p>
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
                  <div>
                    <h3 className="font-serif text-lg text-[#1a1a1a] mb-1">Site Visit Information</h3>
                    <p className="text-sm text-gray-600">Schedule a visit to see our work in action</p>
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
