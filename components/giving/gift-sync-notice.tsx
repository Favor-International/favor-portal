"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GiftSyncNotice({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="rounded-xl border border-[#e1a730]/50 bg-[#fffdf7] px-4 py-3 text-sm text-[#3d4a38]">
      <p className="font-semibold text-[#1a1a1a]">Your gift is syncing</p>
      <p className="mt-1">
        The gift is received. This page usually catches up within a minute. Refresh, or email{" "}
        <a className="font-semibold text-[#2b4d24] underline" href="mailto:partners@favorintl.org">
          partners@favorintl.org
        </a>{" "}
        if it is still empty after a few minutes.
      </p>
      {onRefresh ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRefresh}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh now
        </Button>
      ) : null}
    </div>
  );
}
