"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AssistantPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user?.isAdmin) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (!user?.isAdmin) return null;

  return (
    <div className="space-y-8">
      <div>
        <nav className="mb-2 flex items-center gap-1 text-xs text-[#999999]">
          <Link href="/dashboard" className="hover:text-[#666666]">Home</Link>
          <span>/</span>
          <span className="font-medium text-[#1a1a1a]">Personalization</span>
        </nav>
        <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">Personalization Engine</h1>
        <p className="mt-1 text-sm text-[#666666]">
          This area is reserved for internal tuning. Partner-facing AI surfaces are disabled.
        </p>
      </div>

      <Card className="glass-pane">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-lg">
            <Sparkles className="h-4 w-4 text-[#2b4d24]" />
            Background Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[#666666]">
          <p>
            Personalization signals are processed behind the scenes to tailor dashboard sections and recommended content.
            No chat UI or AI branding is shown to partners.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-[10px]">Dashboard tailoring</Badge>
            <Badge variant="secondary" className="text-[10px]">Content ranking</Badge>
            <Badge variant="secondary" className="text-[10px]">Next-step suggestions</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
