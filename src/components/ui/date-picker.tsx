"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
    date?: Date
    onDateChange?: (date: Date | undefined) => void
    error?: boolean
    // Required string prop to easily emulate standard inputs inside a generic form
    value?: string
}

/**
 * Parses a `yyyy-MM-dd` string as a *local* date. `new Date('2025-03-15')`
 * parses as UTC midnight, which renders as the previous day for anyone west
 * of UTC.
 */
function parseDateValue(value?: string): Date | undefined {
    if (!value) return undefined

    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (ymd) {
        return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    }

    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? undefined : parsed
}

export function DatePicker({
    date,
    onDateChange,
    className,
    error,
    placeholder = "Pick a date",
    value,
    onChange,
    name,
    disabled,
    ...props
}: DatePickerProps) {
    const [open, setOpen] = React.useState(false)

    // Try to parse an initial date string if `date` is not provided directly
    const [internalDate, setInternalDate] = React.useState<Date | undefined>(
        () => date ?? parseDateValue(value)
    )

    // Keep internal state in sync with external `date` / `value` props
    React.useEffect(() => {
        if (date !== undefined) setInternalDate(date)
        else setInternalDate(parseDateValue(value))
    }, [date, value])

    const handleSelect = (newDate: Date | undefined) => {
        setInternalDate(newDate)
        if (onDateChange) onDateChange(newDate)

        // Call standard input onChange manually for form integrations
        if (onChange && newDate) {
            const e = {
                target: { name: name || '', value: format(newDate, 'yyyy-MM-dd') }
            } as React.ChangeEvent<HTMLInputElement>
            onChange(e)
        }

        // Close once a day is chosen — the popover has no other dismiss action.
        if (newDate) setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "w-full flex items-center px-4 py-3 bg-gray-50 border rounded-xl text-left font-normal text-gray-700 transition-all",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        !internalDate && "text-gray-500",
                        error
                            ? "border-red-300 hover:border-red-400 focus:ring-red-500"
                            : "border-gray-200 hover:border-blue-500",
                        disabled && "opacity-50 cursor-not-allowed hover:border-gray-200",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                    {internalDate ? format(internalDate, "PPP") : <span>{placeholder}</span>}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[100]" align="start">
                <Calendar
                    mode="single"
                    selected={internalDate}
                    onSelect={handleSelect}
                    defaultMonth={internalDate}
                    autoFocus
                />
            </PopoverContent>
            {/* Hidden input to ensure standard HTML forms still receive the date value */}
            {name && (
                <input
                    type="hidden"
                    name={name}
                    value={internalDate ? format(internalDate, 'yyyy-MM-dd') : ''}
                    {...props}
                />
            )}
        </Popover>
    )
}
