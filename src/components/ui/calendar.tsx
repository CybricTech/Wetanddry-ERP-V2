"use client"

import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            // Softer base text tone — PopoverContent inherits near-black
            // (text-gray-950), which reads harsh across a dense date grid.
            className={cn("p-3 text-gray-700", className)}
            classNames={{
                // NOTE: these are react-day-picker v9 element keys. v8 names
                // (caption/table/head_row/cell/day_selected/...) are silently
                // ignored by v9 and leave the calendar unstyled.
                months: "relative flex flex-col sm:flex-row gap-4",
                month: "w-full space-y-4",
                // This bar spans the full width above the caption, so it must not
                // capture pointer events - it would otherwise sit on top of the
                // month/year dropdowns and swallow their clicks. The buttons opt
                // back in individually.
                nav: "absolute inset-x-0 top-0 z-10 flex items-center justify-between pointer-events-none",
                button_previous: cn(
                    "pointer-events-auto",
                    "h-7 w-7 bg-transparent p-0 text-gray-500 inline-flex items-center justify-center rounded-md border border-gray-200 transition-colors",
                    "hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50",
                    "disabled:opacity-30 disabled:pointer-events-none"
                ),
                button_next: cn(
                    "pointer-events-auto",
                    "h-7 w-7 bg-transparent p-0 text-gray-500 inline-flex items-center justify-center rounded-md border border-gray-200 transition-colors",
                    "hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50",
                    "disabled:opacity-30 disabled:pointer-events-none"
                ),
                // Caption sits between the prev/next buttons, which are absolutely
                // positioned at the edges - the padding keeps the dropdowns clear of them.
                // min-h rather than a fixed h: the bordered dropdowns are taller
                // than the plain caption label this row used to hold.
                month_caption: "flex min-h-7 items-center justify-center px-9",
                // Also rendered inside each dropdown as the visible face of the
                // transparent <select>, so it carries the padding and chevron gap.
                caption_label: cn(
                    "inline-flex items-center gap-1 whitespace-nowrap",
                    "px-2 py-1 text-sm font-medium text-gray-800"
                ),
                // Shown when captionLayout="dropdown". react-day-picker renders a real
                // <select> over a label, so the select is made transparent and stretched
                // across the styled wrapper to stay accessible while looking native.
                dropdowns: "flex items-center gap-1.5",
                dropdown_root: cn(
                    "relative inline-flex items-center rounded-md border border-gray-200 bg-white",
                    "transition-colors hover:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500"
                ),
                dropdown: "absolute inset-0 h-full w-full cursor-pointer opacity-0",
                months_dropdown: "",
                years_dropdown: "",
                month_grid: "w-full border-collapse",
                weekdays: "flex",
                weekday: "w-9 font-normal text-[0.8rem] text-gray-400",
                week: "flex w-full mt-2",
                // In v9 `day` is the grid cell and `day_button` is the button
                // inside it; selection/today flags land on the cell.
                day: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
                day_button: cn(
                    "h-9 w-9 p-0 font-normal text-gray-700 inline-flex items-center justify-center rounded-md",
                    "transition-colors outline-none ring-1 ring-transparent",
                    // Hover outline in the app's accent blue.
                    "hover:ring-blue-500 hover:bg-blue-50 hover:text-blue-700",
                    "focus-visible:ring-2 focus-visible:ring-blue-500"
                ),
                // Hover rules are repeated here so the selected day keeps its
                // fill instead of picking up the lighter hover treatment.
                selected: cn(
                    "[&>button]:bg-blue-600 [&>button]:text-white",
                    "[&>button]:hover:bg-blue-600 [&>button]:hover:text-white [&>button]:hover:ring-transparent"
                ),
                // Scoped with :not([data-selected]) so a selected day that is
                // also today keeps the blue fill.
                today: "[&:not([data-selected])>button]:bg-gray-100 [&:not([data-selected])>button]:text-gray-800",
                outside: "[&>button]:text-gray-300",
                disabled: "[&>button]:text-gray-300 [&>button]:pointer-events-none",
                hidden: "invisible",
                range_start: "[&>button]:rounded-r-none",
                range_end: "[&>button]:rounded-l-none",
                range_middle:
                    "[&>button]:rounded-none [&>button]:bg-blue-50 [&>button]:text-blue-700",
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation, className: chevronClassName }) => {
                    // "down" is used by the month/year dropdowns; without it they
                    // would fall through to a right-pointing arrow.
                    const Icon =
                        orientation === "left"
                            ? ChevronLeft
                            : orientation === "up"
                                ? ChevronUp
                                : orientation === "down"
                                    ? ChevronDown
                                    : ChevronRight
                    return <Icon className={cn("h-4 w-4 shrink-0", chevronClassName)} />
                },
            }}
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }
