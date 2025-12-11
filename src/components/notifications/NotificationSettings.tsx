'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Smartphone, Check, Loader2, AlertTriangle, Package, Truck, FlaskConical, Users } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { getPushPreference, updatePushSubscription, updateNotificationPreferences } from '@/lib/actions/notifications'
import type { NotificationType } from '@/lib/actions/notifications'

// Notification categories for settings UI
const NOTIFICATION_CATEGORIES: {
    name: string
    icon: any
    types: { type: NotificationType; label: string; description: string }[]
}[] = [
        {
            name: 'Approvals',
            icon: Check,
            types: [
                { type: 'new_inventory_item', label: 'New Inventory Items', description: 'When items are submitted for approval' },
                { type: 'stock_transaction_pending', label: 'Stock Transactions', description: 'When stock movements need approval' },
                { type: 'material_request_pending', label: 'Material Requests', description: 'When material requests are submitted' },
                { type: 'item_approved', label: 'Approval Decisions', description: 'When your requests are approved or rejected' },
            ],
        },
        {
            name: 'Inventory Alerts',
            icon: Package,
            types: [
                { type: 'low_stock_alert', label: 'Low Stock Alerts', description: 'When items fall below minimum threshold' },
                { type: 'silo_level_critical', label: 'Silo Level Critical', description: 'When cement silos are running low' },
                { type: 'material_shortage', label: 'Material Shortages', description: 'When production materials are insufficient' },
            ],
        },
        {
            name: 'Fleet & Maintenance',
            icon: Truck,
            types: [
                { type: 'maintenance_due_date', label: 'Scheduled Maintenance', description: 'When service dates are approaching' },
                { type: 'maintenance_due_mileage', label: 'Mileage Alerts', description: 'When mileage thresholds are reached' },
                { type: 'document_expiring', label: 'Document Expiry', description: 'When documents are about to expire' },
                { type: 'spare_parts_low', label: 'Spare Parts Low', description: 'When spare parts inventory is low' },
            ],
        },
        {
            name: 'Exceptions',
            icon: AlertTriangle,
            types: [
                { type: 'new_exception', label: 'New Exceptions', description: 'When dump/divert incidents are reported' },
                { type: 'exception_resolved', label: 'Exception Resolved', description: 'When exceptions are marked resolved' },
            ],
        },
        {
            name: 'Production',
            icon: FlaskConical,
            types: [
                { type: 'production_completed', label: 'Production Runs', description: 'When batches are completed' },
            ],
        },
        {
            name: 'System',
            icon: Users,
            types: [
                { type: 'user_created', label: 'New Users', description: 'When new user accounts are created' },
                { type: 'role_changed', label: 'Role Changes', description: 'When user roles are modified' },
            ],
        },
    ]

interface NotificationPreference {
    inApp: boolean
    push: boolean
}

export default function NotificationSettings() {
    const { data: session, status: authStatus } = useSession()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [pushEnabled, setPushEnabled] = useState(false)
    const [pushSupported, setPushSupported] = useState(false)
    const [preferences, setPreferences] = useState<Record<string, NotificationPreference>>({})
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Check push support
    useEffect(() => {
        setPushSupported(
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window
        )
    }, [])

    // Load preferences
    useEffect(() => {
        const loadPreferences = async () => {
            if (authStatus !== 'authenticated') return

            setIsLoading(true)
            try {
                const pref = await getPushPreference()
                if (pref) {
                    setPushEnabled(pref.pushEnabled)
                    try {
                        setPreferences(JSON.parse(pref.preferences || '{}'))
                    } catch {
                        setPreferences({})
                    }
                }
            } catch (err) {
                console.error('Failed to load preferences:', err)
                setError('Failed to load notification preferences')
            } finally {
                setIsLoading(false)
            }
        }

        loadPreferences()
    }, [authStatus])

    const handleTogglePush = async () => {
        if (!pushSupported) return

        setIsSaving(true)
        setError(null)

        try {
            if (!pushEnabled) {
                // Enable - request permission
                const permission = await Notification.requestPermission()
                if (permission !== 'granted') {
                    setError('Notification permission denied. Please enable in browser settings.')
                    return
                }

                // Register service worker
                let registration = await navigator.serviceWorker.getRegistration()
                if (!registration) {
                    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    await navigator.serviceWorker.ready
                }
            }

            const result = await updatePushSubscription(null, !pushEnabled)
            if (result.success) {
                setPushEnabled(!pushEnabled)
                setSuccessMessage(pushEnabled ? 'Push notifications disabled' : 'Push notifications enabled')
                setTimeout(() => setSuccessMessage(null), 3000)
            } else {
                throw new Error(result.error)
            }
        } catch (err) {
            console.error('Failed to toggle push:', err)
            setError('Failed to update push notification settings')
        } finally {
            setIsSaving(false)
        }
    }

    const handlePreferenceChange = (type: NotificationType, field: 'inApp' | 'push', value: boolean) => {
        setPreferences(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                inApp: prev[type]?.inApp ?? true,
                push: prev[type]?.push ?? true,
                [field]: value,
            },
        }))
    }

    const handleSavePreferences = async () => {
        setIsSaving(true)
        setError(null)

        try {
            const result = await updateNotificationPreferences(preferences)
            if (result.success) {
                setSuccessMessage('Preferences saved successfully')
                setTimeout(() => setSuccessMessage(null), 3000)
            } else {
                throw new Error(result.error)
            }
        } catch (err) {
            console.error('Failed to save preferences:', err)
            setError('Failed to save preferences')
        } finally {
            setIsSaving(false)
        }
    }

    if (authStatus !== 'authenticated') {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500">Please sign in to manage notification settings.</p>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Push Notifications Global Toggle */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${pushEnabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
                            {pushEnabled ? (
                                <Bell className="w-6 h-6 text-blue-600" />
                            ) : (
                                <BellOff className="w-6 h-6 text-gray-400" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Browser Push Notifications</h3>
                            <p className="text-sm text-gray-500">
                                {pushSupported
                                    ? 'Receive notifications even when the app is in the background'
                                    : 'Push notifications are not supported in this browser'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleTogglePush}
                        disabled={!pushSupported || isSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${pushEnabled ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                        role="switch"
                        aria-checked={pushEnabled}
                    >
                        <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${pushEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                        />
                    </button>
                </div>

                {!pushSupported && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
                        <Smartphone size={16} />
                        Try using Chrome, Edge, or Firefox for push notification support
                    </div>
                )}
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <Check size={18} />
                    {successMessage}
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {/* Per-Type Preferences */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Notification Preferences</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Choose which notifications you want to receive
                    </p>
                </div>

                <div className="divide-y divide-gray-100">
                    {NOTIFICATION_CATEGORIES.map((category) => {
                        const CategoryIcon = category.icon
                        return (
                            <div key={category.name} className="px-6 py-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <CategoryIcon size={18} className="text-gray-400" />
                                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                                </div>

                                <div className="space-y-3 ml-7">
                                    {category.types.map((notifType) => {
                                        const pref = preferences[notifType.type] || { inApp: true, push: true }
                                        return (
                                            <div key={notifType.type} className="flex items-center justify-between py-2">
                                                <div className="flex-1 min-w-0 mr-4">
                                                    <p className="text-sm font-medium text-gray-700">{notifType.label}</p>
                                                    <p className="text-xs text-gray-500 truncate">{notifType.description}</p>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {/* In-App Toggle */}
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={pref.inApp}
                                                            onChange={(e) => handlePreferenceChange(notifType.type, 'inApp', e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                        />
                                                        <span className="text-xs text-gray-500">In-App</span>
                                                    </label>

                                                    {/* Push Toggle */}
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={pref.push}
                                                            onChange={(e) => handlePreferenceChange(notifType.type, 'push', e.target.checked)}
                                                            disabled={!pushEnabled}
                                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                                                        />
                                                        <span className={`text-xs ${pushEnabled ? 'text-gray-500' : 'text-gray-400'}`}>Push</span>
                                                    </label>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Save Button */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <button
                        onClick={handleSavePreferences}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving && <Loader2 size={16} className="animate-spin" />}
                        Save Preferences
                    </button>
                </div>
            </div>
        </div>
    )
}
