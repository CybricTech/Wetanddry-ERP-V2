// Shared between server actions and client components. Kept out of
// lib/actions/staff.ts because a 'use server' module may only export
// async functions.

export const EXIT_TYPES = ['Retired', 'Dismissed', 'Resigned', 'Contract Ended', 'Other'] as const

export type ExitType = (typeof EXIT_TYPES)[number]

export const STAFF_STATUSES = ['Active', 'On Leave', 'Contract'] as const

// Staff.department stores the label itself, not an id, so renaming an entry here
// orphans any record still holding the old string - migrate those in the same change.
export const DEPARTMENTS = [
    'Operations',
    'Logistics',
    'Maintenance',
    'Quality Control',
    'HR/Admin',
    'Finance',
    'Management',
] as const

export type Department = (typeof DEPARTMENTS)[number]
