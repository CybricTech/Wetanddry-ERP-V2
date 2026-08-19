"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { parseDateValue, parseTypedDate } from "@/lib/date-parse"
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
    /** Earliest selectable year. Defaults to 100 years back, enough for a date of birth. */
    fromYear?: number
    /** Latest selectable year. Defaults to 10 years ahead, enough for expiry and due dates. */
    toYear?: number
}

/** How a committed date is shown once the field loses focus. */
const DISPLAY_FORMAT = "d MMM yyyy"

export function DatePicker({
    date,
    onDateChange,
    className,
    error,
    placeholder = "dd/mm/yyyy",
    value,
    onChange,
    name,
    disabled,
    fromYear,
    toYear,
    ...props
}: DatePickerProps) {
    const initial = date ?? parseDateValue(value)

    const [open, setOpen] = React.useState(false)
    const [invalid, setInvalid] = React.useState(false)
    const [internalDate, setInternalDate] = React.useState<Date | undefined>(() => initial)
    const [text, setText] = React.useState(() => (initial ? format(initial, DISPLAY_FORMAT) : ""))

    // A ref, not state: nothing renders from it, and keeping it out of the sync
    // effect's deps stops focus changes from re-triggering that effect.
    const focusedRef = React.useRef(false)
    // The last value this component put into, or took from, the outside world.
    // Comparing against it distinguishes a genuine external change from an echo
    // of our own commit.
    const lastSyncedRef = React.useRef(initial ? format(initial, "yyyy-MM-dd") : "")

    // Adopt `date` / `value` only when they actually change externally. Without
    // the guard, blurring on unparseable text would immediately overwrite it with
    // the previous value and clear the error the user needs to see.
    React.useEffect(() => {
        const next = date !== undefined ? date : parseDateValue(value)
        const nextIso = next ? format(next, "yyyy-MM-dd") : ""

        if (nextIso === lastSyncedRef.current) return
        lastSyncedRef.current = nextIso

        setInternalDate(next)
        if (!focusedRef.current) {
            setText(next ? format(next, DISPLAY_FORMAT) : "")
            setInvalid(false)
        }
    }, [date, value])

    const currentYear = new Date().getFullYear()
    const startMonth = new Date(fromYear ?? currentYear - 100, 0)
    const endMonth = new Date(toYear ?? currentYear + 10, 11)

    const commit = React.useCallback(
        (newDate: Date | undefined) => {
            const iso = newDate ? format(newDate, "yyyy-MM-dd") : ""
            // Record it before notifying, so the value coming back through props
            // is recognised as our own echo rather than an external change.
            lastSyncedRef.current = iso

            setInternalDate(newDate)
            setInvalid(false)
            if (onDateChange) onDateChange(newDate)

            // Call standard input onChange manually for form integrations
            if (onChange) {
                const e = {
                    target: { name: name || "", value: iso },
                } as React.ChangeEvent<HTMLInputElement>
                onChange(e)
            }
        },
        [onChange, onDateChange, name]
    )

    const handleSelect = (newDate: Date | undefined) => {
        commit(newDate)
        setText(newDate ? format(newDate, DISPLAY_FORMAT) : "")
        if (newDate) setOpen(false)
    }

    const handleTextChange = (raw: string) => {
        setText(raw)

        if (!raw.trim()) {
            commit(undefined)
            return
        }

        // Commit as soon as the text parses, so the calendar follows along, but
        // hold off on flagging an error until blur - every partial entry is
        // invalid on its way to being valid.
        const parsed = parseTypedDate(raw)
        if (parsed) {
            commit(parsed)
            setInvalid(false)
        }
    }

    const handleBlur = () => {
        focusedRef.current = false

        if (!text.trim()) {
            setInvalid(false)
            commit(undefined)
            return
        }

        const parsed = parseTypedDate(text)
        if (parsed) {
            commit(parsed)
            setText(format(parsed, DISPLAY_FORMAT))
        } else {
            setInvalid(true)
        }
    }

    const showError = error || invalid

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <div className="relative">
                <input
                    type="text"
                    // Deliberately not inputMode="numeric": that keypad hides "/"
                    // and letters on mobile, blocking both 15/03/2025 and 15 Mar 2025.
                    autoComplete="off"
                    disabled={disabled}
                    value={text}
                    placeholder={placeholder}
                    onFocus={() => { focusedRef.current = true }}
                    onBlur={handleBlur}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            handleBlur()
                            setOpen(false)
                        }
                        if (e.key === "Escape") setOpen(false)
                        // Let the keyboard reach the calendar without leaving the field.
                        if (e.key === "ArrowDown" && !open) setOpen(true)
                    }}
                    aria-invalid={showError || undefined}
                    className={cn(
                        "w-full px-4 py-3 pr-11 bg-gray-50 border rounded-xl text-left font-normal text-gray-700 transition-all",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        "placeholder:text-gray-400",
                        showError
                            ? "border-red-300 hover:border-red-400 focus:ring-red-500"
                            : "border-gray-200 hover:border-blue-500",
                        disabled && "opacity-50 cursor-not-allowed hover:border-gray-200",
                        className
                    )}
                />
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        tabIndex={-1}
                        aria-label="Open calendar"
                        className={cn(
                            "absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-500 transition-colors",
                            "hover:text-blue-600 hover:bg-blue-50",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                            disabled && "pointer-events-none opacity-50"
                        )}
                    >
                        <CalendarIcon className="h-4 w-4" />
                    </button>
                </PopoverTrigger>
            </div>

            <PopoverContent className="w-auto p-0 z-[100]" align="start">
                <Calendar
                    mode="single"
                    selected={internalDate}
                    onSelect={handleSelect}
                    defaultMonth={internalDate}
                    captionLayout="dropdown"
                    startMonth={startMonth}
                    endMonth={endMonth}
                    autoFocus
                />
                <div className="flex items-center justify-between gap-2 border-t border-gray-100 p-2">
                    <button
                        type="button"
                        onClick={() => handleSelect(new Date())}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            handleSelect(undefined)
                            setOpen(false)
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </PopoverContent>

            {/* Hidden input to ensure standard HTML forms still receive the date value */}
            {name && (
                <input
                    type="hidden"
                    name={name}
                    value={internalDate ? format(internalDate, "yyyy-MM-dd") : ""}
                    {...props}
                />
            )}
        </Popover>
    )
}
