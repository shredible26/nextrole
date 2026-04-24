"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      navLayout="around"
      fixedWeeks
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-4",
        month_caption: "relative flex h-8 items-center justify-center px-8",
        caption_label: "text-sm font-medium text-white",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30",
        button_next:
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30",
        month_grid: "w-full border-collapse",
        weekdays: "",
        weekday:
          "h-9 w-10 min-w-10 p-0 text-center text-xs font-medium text-gray-400",
        week: "",
        day: cn(
          "h-10 w-10 p-0 text-center text-sm [&:has([aria-selected])]:bg-accent/50",
          props.mode === "range"
            ? "[&:has(.rdp-range_start)]:rounded-l-md [&:has(.rdp-range_end)]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day_button:
          "flex h-10 w-10 items-center justify-center rounded-md text-sm text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 aria-selected:bg-indigo-500 aria-selected:text-white aria-selected:hover:bg-indigo-500",
        selected: "bg-indigo-500 text-white rounded-md",
        today: "text-indigo-300 font-semibold",
        outside: "text-gray-600",
        disabled: "text-gray-600 opacity-50",
        range_middle: "bg-white/5 text-white rounded-none",
        range_start: "bg-indigo-500 text-white rounded-md",
        range_end: "bg-indigo-500 text-white rounded-md",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation, ...componentProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("size-4", chevronClassName)} {...componentProps} />;
          }

          if (orientation === "down") {
            return <ChevronDown className={cn("size-4", chevronClassName)} {...componentProps} />;
          }

          return <ChevronRight className={cn("size-4", chevronClassName)} {...componentProps} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
