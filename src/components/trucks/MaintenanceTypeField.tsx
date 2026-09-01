'use client'

import { useState } from 'react'

export const OTHER = 'Other'

/**
 * Maintenance type picker with a free-text escape hatch.
 *
 * "Other" is not itself a type — choosing it swaps the field for a text input whose
 * value is submitted as `type`, so the literal string "Other" never reaches the
 * database. MaintenanceRecord.type and MaintenanceSchedule.type are free-form String
 * columns, so a custom value needs no schema change.
 */
export default function MaintenanceTypeField({
    options,
    defaultValue,
    focusRing = 'focus:ring-blue-500',
}: {
    /** Preset types for this form. The two modals deliberately offer different lists. */
    options: readonly string[]
    /** An existing record's type. A value outside `options` opens as a custom entry. */
    defaultValue?: string
    focusRing?: string
}) {
    const preset = Boolean(defaultValue) && options.includes(defaultValue!)

    // A stored type outside the preset list is a custom one, so it must open on Other
    // with the text prefilled. Without this, editing a custom record would show a blank
    // dropdown and silently reset its type on save.
    const [choice, setChoice] = useState(defaultValue ? (preset ? defaultValue : OTHER) : '')
    const [custom, setCustom] = useState(preset ? '' : (defaultValue ?? ''))

    const isCustom = choice === OTHER
    const field = `w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${focusRing} focus:border-transparent transition-all`

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Maintenance Type <span className="text-red-500">*</span>
            </label>
            <select
                // Named only while a preset is chosen. Two fields called `type` would
                // make FormData.get return the select's "Other" instead of the text.
                name={isCustom ? undefined : 'type'}
                required
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className={field}
            >
                <option value="">Select type</option>
                {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
                <option value={OTHER}>{OTHER}</option>
            </select>

            {isCustom && (
                <input
                    type="text"
                    name="type"
                    required
                    autoFocus
                    maxLength={80}
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    // Trimmed on blur so spaces are still typeable mid-word. The server
                    // trims too, for the path where submit fires without a blur.
                    onBlur={(e) => setCustom(e.target.value.trim())}
                    placeholder="Describe the maintenance type"
                    className={`${field} mt-2`}
                />
            )}
        </div>
    )
}
