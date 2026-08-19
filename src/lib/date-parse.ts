import { isValid, parse } from 'date-fns'

/**
 * Lenient parsing for hand-typed dates, kept free of React so it can be tested
 * and reused outside the date picker.
 *
 * Numeric input is read day-first (15/03/2025 is 15 March), matching how dates
 * are written locally. Where day-first is impossible the month-first reading is
 * used instead, so 03/25/2025 still resolves rather than being rejected.
 */

/** Formats accepted when the month is typed as a word, e.g. "15 Mar 2025". */
const TEXTUAL_FORMATS = [
    'd MMM yyyy',
    'd MMMM yyyy',
    'MMM d yyyy',
    'MMMM d yyyy',
    'MMM d, yyyy',
    'MMMM d, yyyy',
    'd MMM yy',
    'd MMMM yy',
]

const NUMERIC_PATTERNS: { re: RegExp; order: 'dmy' | 'ymd' }[] = [
    // 2025-03-15 (ISO). Tested first: a 4-digit leading group is unambiguous.
    { re: /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/, order: 'ymd' },
    // 15/03/2025, 15-3-25, 15.03.2025
    { re: /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/, order: 'dmy' },
    // 15032025 / 150325, typed straight off a keypad
    { re: /^(\d{2})(\d{2})(\d{4})$/, order: 'dmy' },
    { re: /^(\d{2})(\d{2})(\d{2})$/, order: 'dmy' },
]

/** Two-digit years land in the current century unless that is far in the future. */
export function expandYear(year: number): number {
    if (year >= 100) return year
    const century = Math.floor(new Date().getFullYear() / 100) * 100
    const candidate = century + year
    return candidate > new Date().getFullYear() + 20 ? candidate - 100 : candidate
}

/**
 * Builds a date only if the parts survive the round trip, so 31/02/2025 is
 * rejected rather than silently rolling over into March.
 */
function buildDate(day: number, month: number, year: number): Date | undefined {
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return undefined
    }
    return date
}

/**
 * Parses whatever the user typed. Accepts 15/03/2025, 15-3-25, 2025-03-15,
 * 15032025 and "15 Mar 2025". Returns undefined for anything unrecognisable so
 * the caller can flag it rather than guess.
 */
export function parseTypedDate(input: string): Date | undefined {
    const text = input.trim()
    if (!text) return undefined

    for (const { re, order } of NUMERIC_PATTERNS) {
        const match = re.exec(text)
        if (!match) continue

        const [a, b, c] = [Number(match[1]), Number(match[2]), Number(match[3])]

        if (order === 'ymd') {
            return buildDate(c, b, a)
        }

        return buildDate(a, b, expandYear(c)) ?? buildDate(b, a, expandYear(c))
    }

    for (const pattern of TEXTUAL_FORMATS) {
        const parsed = parse(text, pattern, new Date())
        if (isValid(parsed)) return parsed
    }

    return undefined
}

/**
 * Parses a `yyyy-MM-dd` string as a *local* date. `new Date('2025-03-15')`
 * parses as UTC midnight, which renders as the previous day for anyone west
 * of UTC.
 */
export function parseDateValue(value?: string): Date | undefined {
    if (!value) return undefined

    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (ymd) {
        return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    }

    const parsed = new Date(value)
    return isNaN(parsed.getTime()) ? undefined : parsed
}
