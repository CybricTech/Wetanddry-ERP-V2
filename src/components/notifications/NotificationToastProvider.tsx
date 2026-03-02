'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

export default function NotificationToastProvider() {
    const { data: session, status } = useSession()
    const lastKnownCount = useRef<number | null>(null)
    const isAuthenticated = status === 'authenticated' && !!session?.user

    const checkForNewNotifications = useCallback(async () => {
        if (!isAuthenticated) return

        try {
            const { getUnreadCount } = await import('@/lib/actions/notifications')
            const currentCount = await getUnreadCount()

            if (lastKnownCount.current !== null && currentCount > lastKnownCount.current) {
                // New notifications detected - fetch the latest one
                const { getMyNotifications } = await import('@/lib/actions/notifications')
                const result = await getMyNotifications(1, false)

                if (result.success && result.notifications.length > 0) {
                    const latest = result.notifications[0]
                    toast(latest.title, {
                        description: latest.message,
                        duration: 6000,
                    })
                }
            }

            lastKnownCount.current = currentCount
        } catch (error) {
            // Silently fail - don't disrupt the user experience
        }
    }, [isAuthenticated])

    useEffect(() => {
        if (!isAuthenticated) return

        // Initial count fetch (no toast on first load)
        const initTimeout = setTimeout(async () => {
            try {
                const { getUnreadCount } = await import('@/lib/actions/notifications')
                lastKnownCount.current = await getUnreadCount()
            } catch {
                // ignore
            }
        }, 2000)

        // Poll every 30 seconds
        const interval = setInterval(checkForNewNotifications, 30000)

        return () => {
            clearTimeout(initTimeout)
            clearInterval(interval)
        }
    }, [isAuthenticated, checkForNewNotifications])

    return null
}
