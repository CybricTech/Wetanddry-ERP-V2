'use client'

import React, { useState, useTransition } from 'react'
import {
    Calendar, Plus, Clock, CheckCircle, AlertTriangle,
    Play, X, RefreshCw, Building2, ChevronRight
} from 'lucide-react'
import { hasPermission } from '@/lib/permissions'
import {
    scheduleProductionRun,
    rescheduleProductionRun,
    startProductionRun,
    getScheduledRuns
} from '@/lib/actions/production'

// ==================== TYPES ====================

interface ScheduledRun {
    id: string
    recipeId: string
    recipe: { id: string; name: string; productCode: string }
    siloId: string
    silo: { id: string; name: string }
    plannedQuantity: number
    quantity: number
    scheduledDate: Date
    plannedStartTime: Date | null
    actualStartTime: Date | null
    status: string
    client: { id: string; name: string } | null
    order: { id: string; orderNumber: string } | null
    delayReason: string | null
}

// ==================== MAIN COMPONENT ====================

interface SchedulingClientProps {
    initialRuns: ScheduledRun[]
    recipes: { id: string; productCode: string; name: string }[]
    silos: { id: string; name: string; cementItem: any }[]
    clients: { id: string; code: string; name: string }[]
    userRole: string
    userName: string
}

export default function SchedulingClient({
    initialRuns,
    recipes,
    silos,
    clients,
    userRole,
    userName
}: SchedulingClientProps) {
    const [runs, setRuns] = useState<ScheduledRun[]>(initialRuns)
    const [isPending, startTransition] = useTransition()
    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [showRescheduleModal, setShowRescheduleModal] = useState<ScheduledRun | null>(null)

    const canSchedule = hasPermission(userRole, 'log_production')

    const refreshData = async () => {
        const data = await getScheduledRuns()
        setRuns(data as any)
    }

    const handleStartRun = (id: string) => {
        startTransition(async () => {
            await startProductionRun(id)
            refreshData()
        })
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Scheduled': return 'bg-blue-100 text-blue-700'
            case 'Rescheduled': return 'bg-yellow-100 text-yellow-700'
            case 'Delayed': return 'bg-red-100 text-red-700'
            case 'In Progress': return 'bg-green-100 text-green-700'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    // Group by date
    const groupedRuns: Record<string, ScheduledRun[]> = {}
    runs.forEach(run => {
        const dateKey = new Date(run.scheduledDate).toDateString()
        if (!groupedRuns[dateKey]) groupedRuns[dateKey] = []
        groupedRuns[dateKey].push(run)
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-7 h-7 text-blue-600" />
                        Production Scheduling
                    </h1>
                    <p className="text-gray-500 mt-1">Schedule and manage production runs</p>
                </div>
                {canSchedule && (
                    <button
                        onClick={() => setShowScheduleModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <Plus className="w-5 h-5" />
                        Schedule Production
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Scheduled" value={runs.length} color="bg-blue-100 text-blue-600" />
                <StatCard label="Today" value={runs.filter(r => new Date(r.scheduledDate).toDateString() === new Date().toDateString()).length} color="bg-green-100 text-green-600" />
                <StatCard label="Delayed" value={runs.filter(r => r.status === 'Delayed').length} color="bg-red-100 text-red-600" />
                <StatCard label="Rescheduled" value={runs.filter(r => r.status === 'Rescheduled').length} color="bg-yellow-100 text-yellow-600" />
            </div>

            {/* Scheduled Runs by Date */}
            <div className="space-y-6">
                {Object.keys(groupedRuns).length === 0 ? (
                    <div className="bg-white rounded-xl border p-12 text-center">
                        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900">No scheduled runs</h3>
                        <p className="text-gray-500 mt-1">Schedule your first production run to get started</p>
                    </div>
                ) : (
                    Object.entries(groupedRuns).map(([dateKey, dateRuns]) => (
                        <div key={dateKey} className="bg-white rounded-xl border overflow-hidden">
                            <div className="bg-gray-50 px-4 py-3 border-b flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-gray-500" />
                                <span className="font-semibold text-gray-900">
                                    {new Date(dateKey).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </span>
                                <span className="text-sm text-gray-500">({dateRuns.length} runs)</span>
                            </div>
                            <div className="divide-y">
                                {dateRuns.map(run => (
                                    <div key={run.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div>
                                                    <div className="font-medium text-gray-900">{run.recipe.name}</div>
                                                    <div className="text-sm text-gray-500">{run.recipe.productCode}</div>
                                                </div>
                                                <span className="text-lg font-bold text-gray-900">{run.plannedQuantity} m³</span>
                                                <div className="text-sm text-gray-500">
                                                    Silo: {run.silo.name}
                                                </div>
                                                {run.client && (
                                                    <div className="flex items-center gap-1 text-sm text-violet-600">
                                                        <Building2 className="w-4 h-4" />
                                                        {run.client.name}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(run.status)}`}>
                                                    {run.status}
                                                </span>
                                                {run.plannedStartTime && (
                                                    <span className="text-sm text-gray-500 flex items-center gap-1">
                                                        <Clock className="w-4 h-4" />
                                                        {new Date(run.plannedStartTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                                {canSchedule && ['Scheduled', 'Rescheduled'].includes(run.status) && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleStartRun(run.id)}
                                                            disabled={isPending}
                                                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-1"
                                                        >
                                                            <Play className="w-4 h-4" /> Start
                                                        </button>
                                                        <button
                                                            onClick={() => setShowRescheduleModal(run)}
                                                            className="px-3 py-1 text-gray-600 hover:bg-gray-100 text-sm rounded-lg flex items-center gap-1"
                                                        >
                                                            <RefreshCw className="w-4 h-4" /> Reschedule
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {run.delayReason && (
                                            <div className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                                <AlertTriangle className="w-4 h-4" />
                                                {run.delayReason}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Schedule Modal */}
            {showScheduleModal && (
                <ScheduleModal
                    recipes={recipes}
                    silos={silos}
                    clients={clients}
                    onClose={() => setShowScheduleModal(false)}
                    onSuccess={() => {
                        setShowScheduleModal(false)
                        startTransition(refreshData)
                    }}
                />
            )}

            {/* Reschedule Modal */}
            {showRescheduleModal && (
                <RescheduleModal
                    run={showRescheduleModal}
                    onClose={() => setShowRescheduleModal(null)}
                    onSuccess={() => {
                        setShowRescheduleModal(null)
                        startTransition(refreshData)
                    }}
                />
            )}
        </div>
    )
}

// ==================== STAT CARD ====================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color}`}>
                    <Calendar className="w-5 h-5" />
                </div>
                <div>
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-xs text-gray-500">{label}</div>
                </div>
            </div>
        </div>
    )
}

// ==================== SCHEDULE MODAL ====================

function ScheduleModal({
    recipes,
    silos,
    clients,
    onClose,
    onSuccess
}: {
    recipes: { id: string; productCode: string; name: string }[]
    silos: { id: string; name: string; cementItem: any }[]
    clients: { id: string; code: string; name: string }[]
    onClose: () => void
    onSuccess: () => void
}) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState('')

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        startTransition(async () => {
            try {
                const result = await scheduleProductionRun(formData)
                if (result.success) {
                    onSuccess()
                } else {
                    setError('Failed to schedule production')
                }
            } catch (err: any) {
                setError(err.message || 'An error occurred')
            }
        })
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const defaultDate = tomorrow.toISOString().split('T')[0]

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Schedule Production Run</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Recipe *</label>
                            <select name="recipeId" required className="w-full border rounded-lg px-3 py-2">
                                <option value="">Select Recipe</option>
                                {recipes.map(r => (
                                    <option key={r.id} value={r.id}>{r.productCode} - {r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Silo *</label>
                            <select name="siloId" required className="w-full border rounded-lg px-3 py-2">
                                <option value="">Select Silo</option>
                                {silos.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (m³) *</label>
                            <input type="number" name="plannedQuantity" step="0.5" min="1" required className="w-full border rounded-lg px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
                            <input type="date" name="scheduledDate" defaultValue={defaultDate} required className="w-full border rounded-lg px-3 py-2" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                            <input type="time" name="plannedStartTime" className="w-full border rounded-lg px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                            <input type="time" name="plannedEndTime" className="w-full border rounded-lg px-3 py-2" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client (Optional)</label>
                        <select name="clientId" className="w-full border rounded-lg px-3 py-2">
                            <option value="">No Client</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea name="notes" rows={2} className="w-full border rounded-lg px-3 py-2" />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                            {isPending ? 'Scheduling...' : 'Schedule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ==================== RESCHEDULE MODAL ====================

function RescheduleModal({
    run,
    onClose,
    onSuccess
}: {
    run: ScheduledRun
    onClose: () => void
    onSuccess: () => void
}) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState('')

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        formData.append('productionRunId', run.id)

        startTransition(async () => {
            try {
                const result = await rescheduleProductionRun(formData)
                if (result.success) {
                    onSuccess()
                } else {
                    setError('Failed to reschedule')
                }
            } catch (err: any) {
                setError(err.message || 'An error occurred')
            }
        })
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Reschedule Production</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-3">
                        <p className="font-medium">{run.recipe.name}</p>
                        <p className="text-sm text-gray-500">{run.plannedQuantity} m³ • Currently: {new Date(run.scheduledDate).toLocaleDateString()}</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Date *</label>
                        <input type="date" name="newScheduledDate" required className="w-full border rounded-lg px-3 py-2" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Delay *</label>
                        <textarea name="delayReason" rows={2} required placeholder="e.g., Material shortage, equipment maintenance..." className="w-full border rounded-lg px-3 py-2" />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending} className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50">
                            {isPending ? 'Rescheduling...' : 'Reschedule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
