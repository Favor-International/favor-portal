"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Calendar, FileText } from "lucide-react";
import { EmptyState } from "@/components/portal/empty-state";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import { PageBreadcrumb, PageBackButton } from "@/components/giving/page-navigation";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { Gift } from "@/types";

export default function GivingHistoryPage() {
  const { user } = useAuth();
  const { gifts, isLoading } = useGiving(user?.id);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  if (isLoading) {
    return <PortalPageSkeleton />;
  }

  const allGifts = gifts;

  // Available years
  const years = [...new Set(allGifts.map((g) => new Date(g.date).getFullYear()))].sort((a, b) => b - a);

  // Filter
  let filtered = allGifts;
  if (yearFilter !== "all") {
    filtered = filtered.filter((g) => new Date(g.date).getFullYear() === Number(yearFilter));
  }
  if (typeFilter !== "all") {
    filtered = filtered.filter((g) =>
      typeFilter === "recurring" ? g.isRecurring : !g.isRecurring
    );
  }

  // Year summaries
  const yearSummaries = years.slice(0, 4).map((year) => {
    const yg = allGifts.filter((g) => new Date(g.date).getFullYear() === year);
    return { year, total: yg.reduce((s, g) => s + g.amount, 0), count: yg.length };
  });

  function exportCSV() {
    const rows = [
      "Date,Amount,Designation,Type,Receipt",
      ...filtered.map(
        (g) =>
          `${new Date(g.date).toLocaleDateString()},${g.amount},${g.designation},${g.isRecurring ? "Recurring" : "One-time"},${g.receiptSent ? "Sent" : "Pending"}`
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `favor-giving-history${yearFilter !== "all" ? `-${yearFilter}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  }

  function downloadReceipt(gift: Gift) {
    const receiptNo = gift.receiptNumber ?? gift.blackbaudGiftId ?? gift.id;
    const text = [
      "FAVOR INTERNATIONAL - GIFT RECORD",
      "=".repeat(42),
      "",
      `Receipt #: ${receiptNo}`,
      `Gift date: ${new Date(gift.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      gift.receiptDate ? `Receipted: ${new Date(gift.receiptDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}` : "",
      `Donor: ${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim(),
      `Amount: ${formatCurrency(gift.amount)}`,
      `Designation: ${gift.designation}`,
      `Type: ${gift.isRecurring ? "Recurring" : "One-time"}`,
      "",
      "Favor International, Inc. - EIN: 47-5225697",
      "11268 Winthrop Main Street #102, Riverview, FL 33578",
      "501(c)(3) public charity",
      "",
      "Your official tax receipt is issued by Blackbaud, Favor's donation",
      "processor, at the time of each gift.",
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `favor-receipt-${gift.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded");
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageBackButton href="/giving" label="Back to Giving" />
          <PageBreadcrumb items={[
            { label: "Giving", href: "/giving" },
            { label: "History" }
          ]} />
          <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">Giving History</h1>
          <p className="mt-1 text-sm text-[#666666]">
            View and download your complete giving history for tax purposes.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Year summary cards */}
      {yearSummaries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {yearSummaries.map((ys) => (
            <button
              key={ys.year}
              onClick={() => setYearFilter(yearFilter === String(ys.year) ? "all" : String(ys.year))}
              className={`rounded-xl p-4 text-left glass-transition ${
                yearFilter === String(ys.year)
                  ? "border border-[#2b4d24]/30 bg-[#2b4d24]/5 backdrop-blur-sm"
                  : "glass-pane glass-hover"
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-[#999999]">
                <Calendar className="h-3.5 w-3.5" />
                {ys.year}
              </div>
              <p className="mt-1 text-xl font-semibold text-[#1a1a1a]">
                {formatCurrency(ys.total)}
              </p>
              <p className="text-xs text-[#666666]">{ys.count} gifts</p>
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="one-time">One-time</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
          </SelectContent>
        </Select>
        {(yearFilter !== "all" || typeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setYearFilter("all"); setTypeFilter("all"); }}
            className="text-xs text-[#666666]"
          >
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-xs text-[#999999]">
          {filtered.length} {filtered.length === 1 ? "gift" : "gifts"}
        </span>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">Designation</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((gift) => (
                    <TableRow key={gift.id}>
                      <TableCell className="text-sm text-[#666666]">
                        {new Date(gift.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium text-[#1a1a1a]">
                        ${gift.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-[#666666]">
                        {gift.designation}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={gift.isRecurring ? "default" : "secondary"} className="text-[10px]">
                            {gift.isRecurring ? "Recurring" : "One-time"}
                          </Badge>
                          {gift.receipted ? (
                            <Badge className="border-0 bg-[#2b4d24]/10 text-[10px] text-[#2b4d24]" title={gift.receiptNumber ? `Receipt #${gift.receiptNumber}` : "Receipted"}>
                              Receipted
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-[#2b4d24] hover:text-[#1a3a15]"
                          onClick={() => downloadReceipt(gift)}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={FileText}
          title="No gifts match your filters"
          description="Try adjusting the year or type filter to see your giving history."
        />
      )}

      {/* Tax Info */}
      <Card className="glass-subtle border-0">
        <CardContent className="p-6">
          <h3 className="font-serif text-lg font-semibold text-[#1a1a1a]">Tax Information</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Organization", value: "Favor International, Inc." },
              { label: "Tax ID (EIN)", value: "47-5225697" },
              { label: "Classification", value: "501(c)(3) Non-Profit" },
              { label: "Deductibility", value: "Fully tax-deductible" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-[#999999]">{item.label}</p>
                <p className="mt-0.5 text-sm font-medium text-[#1a1a1a]">{item.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[#999999]">
            Annual tax receipts are sent by January 31st of each year. Contact giving@favorinternational.org for duplicates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
