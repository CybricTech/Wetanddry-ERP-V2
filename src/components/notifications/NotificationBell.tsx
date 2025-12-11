'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, Check, CheckCheck, Clock, AlertTriangle, Package, Truck, Fuel, FlaskConical, Users, X, Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/lib/actions/notifications'
import { formatDistanceToNow } from 'date-fns'

// Notification type to icon/color mapping
const NOTIFICATION_STYLES: Record<string, { icon: any; color: string; bgColor: string }> = {
    // Approval requests
    new_inventory_item: { icon: Package, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    stock_transaction_pending: { icon: Package, color: 'text-amber-600', bgColor: 'bg-amber-100' },
    material_request_pending: { icon: Package, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    // Approval decisions
    item_approved: { icon: Check, color: 'text-green-600', bgColor: 'bg-green-100' },
    item_rejected: { icon: X, color: 'text-red-600', bgColor: 'bg-red-100' },
    transaction_approved: { icon: Check, color: 'text-green-600', bgColor: 'bg-green-100' },
    transaction_rejected: { icon: X, color: 'text-red-600', bgColor: 'bg-red-100' },
    request_approved: { icon: Check, color: 'text-green-600', bgColor: 'bg-green-100' },
    request_rejected: { icon: X, color: 'text-red-600', bgColor: 'bg-red-100' },
    // Alerts
    low_stock_alert: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
    silo_level_critical: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
    // Fleet
    maintenance_due_date: { icon: Truck, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    maintenance_due_mileage: { icon: Truck, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    document_expiring: { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    spare_parts_low: { icon: Package, color: 'text-amber-600', bgColor: 'bg-amber-100' },
    // Exceptions
    new_exception: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
    exception_resolved: { icon: CheckCheck, color: 'text-green-600', bgColor: 'bg-green-100' },
    // Production
    production_completed: { icon: FlaskConical, color: 'text-teal-600', bgColor: 'bg-teal-100' },
    material_shortage: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
    // System
    user_created: { icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    role_changed: { icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-100' },
}

const PRIORITY_STYLES: Record<string, string> = {
    critical: 'border-l-4 border-l-red-500',
    high: 'border-l-4 border-l-orange-500',
    medium: 'border-l-4 border-l-blue-500',
    low: 'border-l-4 border-l-gray-300',
}

interface Notification {
    id: string
    type: string
    title: string
    message: string
    priority: string
    read: boolean
    entityType: string | null
    entityId: string | null
    createdAt: Date | string
}

// Entity type to route mapping
const getEntityRoute = (entityType: string | null, entityId: string | null): string | null => {
    if (!entityType || !entityId) return null

    const routes: Record<string, string> = {
        inventory_item: `/inventory`,
        stock_transaction: `/inventory`,
        material_request: `/inventory`,
        exception: `/exceptions`,
        truck: `/trucks/${entityId}`,
        maintenance: `/trucks`,
        staff: `/staff`,
        user: `/users`,
    }

    return routes[entityType] || null
}

export default function NotificationBell() {
    const { data: session, status } = useSession()
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    // Fetch unread count on mount and periodically
    const fetchUnreadCount = useCallback(async () => {
        if (status !== 'authenticated') return
        try {
            const count = await getUnreadCount()
            setUnreadCount(count)
        } catch (err) {
            console.error('Failed to fetch unread count:', err)
        }
    }, [status])

    // Fetch notifications when dropdown opens
    const fetchNotifications = useCallback(async () => {
        if (status !== 'authenticated') return
        setIsLoading(true)
        setError(null)
        try {
            const result = await getMyNotifications(20, true)
            if (result.success) {
                setNotifications(result.notifications)
            } else {
                setError(result.error || 'Failed to load notifications')
            }
        } catch (err) {
            console.error('Failed to fetch notifications:', err)
            setError('Failed to load notifications')
        } finally {
            setIsLoading(false)
        }
    }, [status])

    // Initial load and polling
    useEffect(() => {
        fetchUnreadCount()
        const interval = setInterval(fetchUnreadCount, 30000) // Poll every 30s
        return () => clearInterval(interval)
    }, [fetchUnreadCount])

    // Load notifications when dropdown opens
    useEffect(() => {
        if (isOpen) {
            fetchNotifications()
        }
    }, [isOpen, fetchNotifications])

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false)
                buttonRef.current?.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await markAsRead(notificationId)
            setNotifications(prev =>
                prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
            )
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (err) {
            console.error('Failed to mark as read:', err)
        }
    }

    const handleMarkAllAsRead = async () => {
        try {
            await markAllAsRead()
            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            setUnreadCount(0)
        } catch (err) {
            console.error('Failed to mark all as read:', err)
        }
    }

    const handleNotificationClick = (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            handleMarkAsRead(notification.id)
        }

        // Navigate to entity if available
        const route = getEntityRoute(notification.entityType, notification.entityId)
        if (route) {
            window.location.href = route
        }

        setIsOpen(false)
    }

    if (status !== 'authenticated') {
        return null
    }

    return (
        <div className="relative">
            {/* Bell Button */}
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <Bell size={22} />

                {/* Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    ref={dropdownRef}
                    className="absolute right-0 mt-2 w-96 max-h-[70vh] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
                    role="menu"
                    aria-label="Notifications"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto max-h-[calc(70vh-56px)]">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                                <p className="text-sm text-gray-500">{error}</p>
                                <button
                                    onClick={fetchNotifications}
                                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4">
                                <Bell className="w-12 h-12 text-gray-300 mb-3" />
                                <p className="text-gray-500 text-sm">No notifications yet</p>
                                <p className="text-gray-400 text-xs mt-1">We&apos;ll notify you of important updates</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {notifications.map((notification) => {
                                    const style = NOTIFICATION_STYLES[notification.type] || {
                                        icon: Bell,
                                        color: 'text-gray-600',
                                        bgColor: 'bg-gray-100',
                                    }
                                    const Icon = style.icon
                                    const priorityStyle = PRIORITY_STYLES[notification.priority] || ''

                                    return (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3 ${!notification.read ? 'bg-blue-50/50' : ''
                                                } ${priorityStyle}`}
                                            role="menuitem"
                                        >
                                            {/* Icon */}
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${style.bgColor} flex items-center justify-center`}>
                                                <Icon size={18} className={style.color} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-sm font-medium truncate ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                                                        {notification.title}
                                                    </p>
                                                    {!notification.read && (
                                                        <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer - Settings Link */}
                    {notifications.length > 0 && (
                        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-100 px-4 py-2">
                            <a
                                href="/settings/notifications"
                                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                            >
                                Notification Settings →
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
