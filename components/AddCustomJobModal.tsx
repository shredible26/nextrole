"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Calendar as CalendarIcon, ChevronDown, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

interface JobFormData {
  jobTitle: string;
  company: string;
  status: CustomJobStatusLabel;
  dateApplied: Date;
  jobUrl: string;
  notes: string;
}

type CustomJobStatusLabel =
  | "Applied"
  | "Phone Screen"
  | "OA"
  | "Interview"
  | "Offer"
  | "Rejected"
  | "Withdrawn";

const STATUS_OPTIONS: CustomJobStatusLabel[] = [
  "Applied",
  "Phone Screen",
  "OA",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];

const STATUS_VALUE_MAP: Record<CustomJobStatusLabel, string> = {
  Applied: "applied",
  "Phone Screen": "phone_screen",
  OA: "oa",
  Interview: "interview",
  Offer: "offer",
  Rejected: "rejected",
  Withdrawn: "withdrawn",
};

function getInitialFormData(): JobFormData {
  return {
    jobTitle: "",
    company: "",
    status: "Applied",
    dateApplied: new Date(),
    jobUrl: "",
    notes: "",
  };
}

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-[#1a1a24] rounded-3xl shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-hidden",
        className
      )}
      {...props}
    >
      <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-6 rounded-lg opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-5 w-5 text-gray-400" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export default function AddCustomJobModal({
  onJobAdded,
}: {
  onJobAdded: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [formData, setFormData] = useState<JobFormData>(getInitialFormData);

  useEffect(() => {
    function updateViewportMode() {
      setIsCompactViewport(window.innerHeight < 900);
    }

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);

    return () => {
      window.removeEventListener("resize", updateViewportMode);
    };
  }, []);

  function resetForm() {
    setFormData(getInitialFormData());
  }

  function handleCancel() {
    setOpen(false);
    resetForm();
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/applications/custom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobTitle: formData.jobTitle,
          company: formData.company,
          status: STATUS_VALUE_MAP[formData.status],
          dateApplied: formData.dateApplied.toISOString(),
          jobUrl: formData.jobUrl,
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add job");
      }

      handleCancel();
      await onJobAdded();
      toast.success("Job added to tracker");
    } catch {
      toast.error("Failed to add job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto gap-2 text-sm border-[#2a2a35] text-[#f0f0fa] bg-[#1a1a24] hover:bg-[#2a2a35]"
        >
          <Plus className="h-4 w-4" />
          Add Custom Job
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "w-[calc(100vw-2rem)] max-w-[30rem]",
          isCompactViewport && "scale-[0.9]"
        )}
      >
        <div className={cn("p-5 sm:p-6", isCompactViewport && "p-4")}>
          <div className={cn("mb-5", isCompactViewport && "mb-4")}>
            <h2 className="mb-2 text-[1.9rem] leading-none font-semibold text-white sm:text-2xl">
              Add Custom Job
            </h2>
            <p className="text-sm text-gray-400">
              Track a new job application manually
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className={cn("space-y-4", isCompactViewport && "space-y-3.5")}
          >
            <div className="space-y-2">
              <Label className="text-xs text-gray-400 uppercase tracking-wider sm:text-sm">
                Job Title <span className="text-indigo-500">*</span>
              </Label>
              <Input
                required
                value={formData.jobTitle}
                onChange={event =>
                  setFormData({ ...formData, jobTitle: event.target.value })
                }
                className="bg-[#0d0d12] border-[#2a2a35] rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Senior Software Engineer"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400 uppercase tracking-wider sm:text-sm">
                Company <span className="text-indigo-500">*</span>
              </Label>
              <Input
                required
                value={formData.company}
                onChange={event =>
                  setFormData({ ...formData, company: event.target.value })
                }
                className="bg-[#0d0d12] border-[#2a2a35] rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Google"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400 uppercase tracking-wider sm:text-sm">
                Status <span className="text-indigo-500">*</span>
              </Label>
              <div className="relative">
                <select
                  value={formData.status}
                  onChange={event =>
                    setFormData({
                      ...formData,
                      status: event.target.value as CustomJobStatusLabel,
                    })
                  }
                  className="h-12 w-full appearance-none rounded-xl border border-[#2a2a35] bg-[#0d0d12] px-4 pr-10 text-base text-white shadow-xs outline-none transition-[color,box-shadow] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 md:text-sm"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status} className="bg-[#1a1a24] text-white">
                      {status}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400 uppercase tracking-wider sm:text-sm">
                Date Applied
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-12 w-full justify-start text-left font-normal bg-[#0d0d12] border-[#2a2a35] rounded-xl text-white hover:bg-[#0d0d12] hover:text-white focus:ring-2 focus:ring-indigo-500 aria-expanded:bg-[#0d0d12] aria-expanded:text-white",
                      !formData.dateApplied && "text-gray-400"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.dateApplied ? (
                      formatDate(formData.dateApplied)
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={8}
                  className="w-auto p-3 bg-[#1a1a24] border-[#2a2a35]"
                >
                  <Calendar
                    mode="single"
                    selected={formData.dateApplied}
                    onSelect={date =>
                      date && setFormData({ ...formData, dateApplied: date })
                    }
                    initialFocus
                    className="text-white"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400 uppercase tracking-wider sm:text-sm">
                Job URL
              </Label>
              <Input
                type="url"
                value={formData.jobUrl}
                onChange={event =>
                  setFormData({ ...formData, jobUrl: event.target.value })
                }
                className="bg-[#0d0d12] border-[#2a2a35] rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400 uppercase tracking-wider sm:text-sm">
                Notes
              </Label>
              <Textarea
                value={formData.notes}
                onChange={event =>
                  setFormData({ ...formData, notes: event.target.value })
                }
                rows={2}
                className="min-h-20 bg-[#0d0d12] border-[#2a2a35] rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                placeholder="Add any additional notes..."
              />
            </div>

            <div className={cn("flex gap-3 pt-3", isCompactViewport && "pt-2")}>
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={submitting}
                className="flex-1 border border-[#2a2a35] text-white hover:bg-[#0d0d12] rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-medium"
              >
                Add Job
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
