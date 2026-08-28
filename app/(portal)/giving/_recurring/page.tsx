"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGiving } from "@/hooks/use-giving";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Repeat,
  Plus,
  Edit3,
  Pause,
  Play,
  Trash2,
  AlertCircle,
  CheckCircle,
  Calendar,
  CreditCard,
} from "lucide-react";
import { SectionHeader } from "@/components/portal/section-header";
import { EmptyState } from "@/components/portal/empty-state";
import { PortalPageSkeleton } from "@/components/portal/portal-page-skeleton";
import { PageBreadcrumb, PageBackButton } from "@/components/giving/page-navigation";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { RecurringGift } from "@/types";

interface EditingGift {
  id: string;
  amount: number;
  frequency: RecurringGift["frequency"];
  nextChargeDate: string;
}

export default function RecurringGiftsPage() {
  const { user } = useAuth();
  const { recurringGifts, isLoading, refresh } = useGiving(user?.id);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<EditingGift | null>(null);
  const [cancellingGiftId, setCancellingGiftId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Create form state
  const [createAmount, setCreateAmount] = useState("");
  const [createFrequency, setCreateFrequency] = useState<RecurringGift["frequency"]>("monthly");
  const [createDesignation, setCreateDesignation] = useState("Where Most Needed");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(createAmount);
    if (amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/giving/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          frequency: createFrequency,
          designation: createDesignation,
        }),
      });

      if (!response.ok) throw new Error("Failed to create recurring gift");

      toast.success("Recurring gift created successfully!");
      setIsCreateOpen(false);
      setCreateAmount("");
      refresh();
    } catch {
      toast.error("Failed to create recurring gift");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGift) return;

    setProcessingId(editingGift.id);
    try {
      const response = await fetch(`/api/giving/recurring/${editingGift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: editingGift.amount,
          frequency: editingGift.frequency,
          nextChargeDate: editingGift.nextChargeDate,
        }),
      });

      if (!response.ok) throw new Error("Failed to update");

      toast.success("Recurring gift updated!");
      setEditingGift(null);
      refresh();
    } catch {
      toast.error("Failed to update recurring gift");
    } finally {
      setProcessingId(null);
    }
  }

  async function handlePauseResume(gift: RecurringGift) {
    setProcessingId(gift.id);
    try {
      const newStatus = gift.status === "active" ? "paused" : "active";
      const response = await fetch(`/api/giving/recurring/${gift.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      toast.success(`Recurring gift ${newStatus === "active" ? "resumed" : "paused"}`);
      refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCancel() {
    if (!cancellingGiftId) return;

    setProcessingId(cancellingGiftId);
    try {
      const response = await fetch(`/api/giving/recurring/${cancellingGiftId}/cancel`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to cancel");

      toast.success("Recurring gift cancelled");
      setCancellingGiftId(null);
      refresh();
    } catch {
      toast.error("Failed to cancel recurring gift");
    } finally {
      setProcessingId(null);
    }
  }

  const activeGifts = recurringGifts.filter((g) => g.status === "active");
  const pausedGifts = recurringGifts.filter((g) => g.status === "paused");
  const totalMonthly = activeGifts
    .filter((g) => g.frequency === "monthly")
    .reduce((sum, g) => sum + g.amount, 0);

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
            { label: "Recurring Gifts" }
          ]} />
          <h1 className="font-serif text-3xl font-semibold text-[#1a1a1a]">
            Recurring Gifts
          </h1>
          <p className="mt-1 text-sm text-[#666666]">
            Manage your ongoing support to Favor International.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-[#2b4d24] hover:bg-[#1a3a15]">
          <Plus className="mr-2 h-4 w-4" />
          New Recurring Gift
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2b4d24]/5">
              <Repeat className="h-5 w-5 text-[#2b4d24]" />
            </div>
            <div>
              <p className="text-xs text-[#999999]">Active Gifts</p>
              <p className="text-xl font-semibold text-[#1a1a1a]">{activeGifts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2b4d24]/5">
              <Calendar className="h-5 w-5 text-[#2b4d24]" />
            </div>
            <div>
              <p className="text-xs text-[#999999]">Monthly Total</p>
              <p className="text-xl font-semibold text-[#1a1a1a]">{formatCurrency(totalMonthly)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2b4d24]/5">
              <CreditCard className="h-5 w-5 text-[#2b4d24]" />
            </div>
            <div>
              <p className="text-xs text-[#999999]">Yearly Projection</p>
              <p className="text-xl font-semibold text-[#1a1a1a]">
                {formatCurrency(totalMonthly * 12)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Gifts */}
      <section>
        <SectionHeader title="Active Recurring Gifts" />
        {activeGifts.length > 0 ? (
          <div className="mt-4 grid gap-4">
            {activeGifts.map((gift) => (
              <Card key={gift.id} className="glass-pane">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2b4d24]/10">
                        <Repeat className="h-5 w-5 text-[#2b4d24]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-[#1a1a1a]">
                            {formatCurrency(gift.amount)}
                          </p>
                          <span className="text-[#666666]">/</span>
                          <span className="text-sm text-[#666666]">{gift.frequency}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#999999]">
                          <Calendar className="h-3.5 w-3.5" />
                          Next charge: {new Date(gift.nextChargeDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[#2b4d24]">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditingGift({
                            id: gift.id,
                            amount: gift.amount,
                            frequency: gift.frequency,
                            nextChargeDate: gift.nextChargeDate,
                          })
                        }
                        disabled={processingId === gift.id}
                      >
                        <Edit3 className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePauseResume(gift)}
                        disabled={processingId === gift.id}
                      >
                        <Pause className="mr-1 h-3.5 w-3.5" />
                        Pause
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setCancellingGiftId(gift.id)}
                        disabled={processingId === gift.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Repeat}
            title="No active recurring gifts"
            description="Set up automatic giving to make an ongoing impact."
            actionLabel="Start Recurring Gift"
            onAction={() => setIsCreateOpen(true)}
          />
        )}
      </section>

      {/* Paused Gifts */}
      {pausedGifts.length > 0 && (
        <section>
          <SectionHeader title="Paused Gifts" />
          <div className="mt-4 grid gap-4">
            {pausedGifts.map((gift) => (
              <Card key={gift.id} className="glass-pane opacity-75">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                        <Pause className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-[#1a1a1a]">
                            {formatCurrency(gift.amount)}
                          </p>
                          <span className="text-[#666666]">/</span>
                          <span className="text-sm text-[#666666]">{gift.frequency}</span>
                        </div>
                        <p className="text-sm text-[#999999]">
                          Created {new Date(gift.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Paused
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePauseResume(gift)}
                        disabled={processingId === gift.id}
                      >
                        <Play className="mr-1 h-3.5 w-3.5" />
                        Resume
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setCancellingGiftId(gift.id)}
                        disabled={processingId === gift.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md glass-elevated border-0">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">New Recurring Gift</DialogTitle>
            <DialogDescription>
              Set up automatic giving to support Favor International&apos;s mission.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="recurring-create-amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]">$</span>
                <Input
                  id="recurring-create-amount"
                  type="number"
                  min={1}
                  placeholder="0"
                  className="pl-7"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurring-create-frequency">Frequency</Label>
              <Select value={createFrequency} onValueChange={(v) => setCreateFrequency(v as RecurringGift["frequency"])}>
                <SelectTrigger id="recurring-create-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurring-create-designation">Designation</Label>
              <Select value={createDesignation} onValueChange={setCreateDesignation}>
                <SelectTrigger id="recurring-create-designation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Where Most Needed">Where Most Needed</SelectItem>
                  <SelectItem value="General Operations">General Operations</SelectItem>
                  <SelectItem value="Education Fund">Education Fund</SelectItem>
                  <SelectItem value="Clean Water Initiative">Clean Water Initiative</SelectItem>
                  <SelectItem value="Community Health">Community Health</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#2b4d24] hover:bg-[#1a3a15]" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Recurring Gift"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingGift} onOpenChange={() => setEditingGift(null)}>
        <DialogContent className="max-w-md glass-elevated border-0">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Edit Recurring Gift</DialogTitle>
          </DialogHeader>
          {editingGift && (
            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="recurring-edit-amount">Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]">$</span>
                  <Input
                    id="recurring-edit-amount"
                    type="number"
                    min={1}
                    className="pl-7"
                    value={editingGift.amount}
                    onChange={(e) =>
                      setEditingGift({ ...editingGift, amount: parseFloat(e.target.value) || 0 })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurring-edit-frequency">Frequency</Label>
                <Select
                  value={editingGift.frequency}
                  onValueChange={(v) =>
                    setEditingGift({ ...editingGift, frequency: v as RecurringGift["frequency"] })
                  }
                >
                  <SelectTrigger id="recurring-edit-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurring-edit-next-charge-date">Next Charge Date</Label>
                <Input
                  id="recurring-edit-next-charge-date"
                  type="date"
                  value={editingGift.nextChargeDate.split("T")[0]}
                  onChange={(e) =>
                    setEditingGift({ ...editingGift, nextChargeDate: e.target.value })
                  }
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingGift(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#2b4d24] hover:bg-[#1a3a15]"
                  disabled={processingId === editingGift.id}
                >
                  {processingId === editingGift.id ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancellingGiftId} onOpenChange={() => setCancellingGiftId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Recurring Gift?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently cancel this recurring gift. You can always set up a new one later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Gift</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
              disabled={processingId === cancellingGiftId}
            >
              {processingId === cancellingGiftId ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
