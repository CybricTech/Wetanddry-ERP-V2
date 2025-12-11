'use client'

import { useState, useEffect } from 'react'
import { Bell, X, Smartphone, Check } from 'lucide-react'
import { updatePushSubscription } from '@/lib/actions/notifications'

interface PushNotificationPromptProps {
    onClose?: () => void
    showOnMount?: boolean
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

// Check if push notifications are supported
const isPushSupported = () => {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    )
}

// Convert VAPID key to Uint8Array
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export default function PushNotificationPrompt({ onClose, showOnMount = true }: PushNotificationPromptProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'denied'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        // Check if we should show the prompt
        const checkAndShow = async () => {
            if (!showOnMount || !isPushSupported()) return

            // Check if user has already made a decision
            const hasSeenPrompt = localStorage.getItem('push-notification-prompted')
            if (hasSeenPrompt) return

            // Check current permission status
            const permission = Notification.permission
            if (permission === 'granted' || permission === 'denied') {
                localStorage.setItem('push-notification-prompted', 'true')
                return
            }

            // Show prompt after a short delay
            setTimeout(() => setIsVisible(true), 2000)
        }

        checkAndShow()
    }, [showOnMount])

    const handleEnable = async () => {
        setIsLoading(true)
        setErrorMessage('')

        try {
            // Request notification permission
            const permission = await Notification.requestPermission()

            if (permission === 'denied') {
                setStatus('denied')
                localStorage.setItem('push-notification-prompted', 'true')
                return
            }

            if (permission !== 'granted') {
                setStatus('error')
                setErrorMessage('Notification permission not granted')
                return
            }

            // Register service worker if not already registered
            let registration = await navigator.serviceWorker.getRegistration()
            if (!registration) {
                registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
                await navigator.serviceWorker.ready
            }

            // Subscribe to push notifications
            if (VAPID_PUBLIC_KEY) {
                try {
                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
                    })

                    // Save subscription to server
                    const result = await updatePushSubscription(JSON.stringify(subscription), true)
                    if (!result.success) {
                        throw new Error(result.error || 'Failed to save subscription')
                    }
                } catch (subError) {
                    console.warn('Push subscription failed (VAPID key may not be configured):', subError)
                    // Still mark as success - in-app notifications will work
                }
            }

            // Save preference
            await updatePushSubscription(null, true)

            setStatus('success')
            localStorage.setItem('push-notification-prompted', 'true')

            // Close after success
            setTimeout(() => {
                setIsVisible(false)
                onClose?.()
            }, 2000)
        } catch (error) {
            console.error('Failed to enable push notifications:', error)
            setStatus('error')
            setErrorMessage('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDismiss = () => {
        localStorage.setItem('push-notification-prompted', 'true')
        setIsVisible(false)
        onClose?.()
    }

    const handleLater = () => {
        // Don't persist - will show again next session
        setIsVisible(false)
        onClose?.()
    }

    if (!isVisible || !isPushSupported()) {
        return null
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-[380px] max-w-[calc(100vw-2rem)]">
                {/* Close button */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Dismiss"
                >
                    <X size={18} />
                </button>

                {status === 'success' ? (
                    // Success state
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">You&apos;re all set!</h3>
                        <p className="text-sm text-gray-500">
                            You&apos;ll receive notifications for important updates.
                        </p>
                    </div>
                ) : status === 'denied' ? (
                    // Denied state
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bell className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Notifications Blocked</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            You can enable notifications later in your browser settings.
                        </p>
                        <button
                            onClick={handleDismiss}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Got it
                        </button>
                    </div>
                ) : (
                    // Default prompt state
                    <>
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Smartphone className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                    Stay Updated
                                </h3>
                                <p className="text-sm text-gray-500">
                                    Get instant notifications for approvals, alerts, and important updates even when you&apos;re not on this page.
                                </p>
                            </div>
                        </div>

                        {/* Benefits */}
                        <ul className="mb-5 space-y-2">
                            {[
                                'Approval requests delivered instantly',
                                'Real-time low stock & maintenance alerts',
                                'Never miss critical exceptions',
                            ].map((benefit, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                                    <Check size={16} className="text-green-500 flex-shrink-0" />
                                    {benefit}
                                </li>
                            ))}
                        </ul>

                        {errorMessage && (
                            <p className="text-sm text-red-500 mb-4">{errorMessage}</p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleLater}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                disabled={isLoading}
                            >
                                Maybe Later
                            </button>
                            <button
                                onClick={handleEnable}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Enabling...
                                    </>
                                ) : (
                                    <>
                                        <Bell size={16} />
                                        Enable Notifications
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// Hook for manual trigger
export function usePushNotificationPrompt() {
    const [showPrompt, setShowPrompt] = useState(false)

    const trigger = () => {
        if (isPushSupported()) {
            setShowPrompt(true)
        }
    }

    const close = () => setShowPrompt(false)

    return { showPrompt, trigger, close }
}
