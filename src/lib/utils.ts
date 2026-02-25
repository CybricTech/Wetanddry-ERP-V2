import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Format a number as Nigerian Naira currency: ₦X,XXX.00
 * Always shows commas and 2 decimal places, no abbreviations.
 */
export function formatCurrency(amount: number | null | undefined): string {
    const value = amount ?? 0
    return `₦${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
