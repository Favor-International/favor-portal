"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, ClipboardCheck, HeartHandshake, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const TASKS = [
  {
    title: "Prayer Partner Follow-Up",
    description: "Call three new prayer partners and record feedback.",
    status: "In Progress",
    progress: 60,
  },
  {
    title: "Event Support Training",
    description: "Complete the event-day volunteer checklist course.",
    status: "Not Started",
    progress: 0,
  },
  {
    title: "Care Package Assembly",
    description: "Prepare 20 partner care packages for mailing.",
    status: "Ready",
    progress: 20,
  },
];

const EVENTS = [
  { title: "Partner Welcome Call Night", date: "Feb 18, 2026", location: "Virtual" },
  { title: "Warehouse Packing Day", date: "Mar 5, 2026", location: "Valrico, FL" },
  { title: "Volunteer Huddle", date: "Mar 22, 2026", location: "Virtual" },
];

export default function VolunteerPage() {
  const { user } = useAuth();

  if (!user || user.constituentType !== "volunteer") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-gray-500">This page is only available to volunteers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-[#1a1a1a]">Volunteer Hub</h1>
          <p className="text-sm text-[#666666]">
            Welcome, {user.firstName}. Track assignments, training, and upcoming opportunities.
          </p>
        </div>
        <Badge variant="outline" className="border-[#2b4d24] text-[#2b4d24]">
          Volunteer Partner
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Active Tasks</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">3</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Hours Logged</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">18.5</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-pane">
          <CardHeader className="pb-2">
            <CardDescription className="text-[#666666]">Next Training</CardDescription>
            <CardTitle className="font-serif text-3xl text-[#2b4d24]">Feb 20</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-[#2b4d24]" />
              Active Assignments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {TASKS.map((task) => (
              <div key={task.title} className="rounded-xl glass-inset p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#1a1a1a]">{task.title}</p>
                    <p className="text-xs text-[#666666]">{task.description}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-[#8b957b]">
                    {task.status}
                  </Badge>
                </div>
                <Progress value={task.progress} className="h-2" />
              </div>
            ))}
            <Button className="w-full bg-[#2b4d24] hover:bg-[#1a3a15]">
              View All Tasks
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#2b4d24]" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {EVENTS.map((event) => (
              <div key={event.title} className="rounded-xl glass-inset p-4">
                <p className="font-medium text-[#1a1a1a]">{event.title}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-[#666666]">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> {event.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {event.location}
                  </span>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full">
              RSVP to Events
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-subtle border-0">
        <CardContent className="p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <HeartHandshake className="h-6 w-6 text-[#2b4d24]" />
            <div>
              <p className="font-medium text-[#1a1a1a]">Volunteer Support</p>
              <p className="text-xs text-[#666666]">Need help with assignments or scheduling?</p>
            </div>
          </div>
          <Button variant="outline">Contact Volunteer Team</Button>
        </CardContent>
      </Card>
    </div>
  );
}
