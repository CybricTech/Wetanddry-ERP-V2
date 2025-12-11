'use client'

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UseLiveUpdatesOptions {
    /** Polling interval in milliseconds (default: 30000 = 30 seconds) */
    interval?: number;
    /** Whether polling is enabled (default: true) */
    enabled?: boolean;
    /** Callback when new updates are detected */
    onUpdate?: () => void;
}

interface UseLiveUpdatesReturn {
    /** Manually trigger a refresh */
    refresh: () => void;
    /** Whether an update is in progress */
    isRefreshing: boolean;
    /** Last refresh timestamp */
    lastRefresh: Date | null;
    /** Number of seconds until next auto-refresh */
    nextRefreshIn: number | null;
}

/**
 * Hook for live updates with smart polling
 * 
 * Uses Next.js router.refresh() for efficient server-side data revalidation
 * without full page reload.
 */
export function useLiveUpdates(options: UseLiveUpdatesOptions = {}): UseLiveUpdatesReturn {
    const {
        interval = 30000, // 30 seconds default
        enabled = true,
        onUpdate
    } = options;

    const router = useRouter();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [nextRefreshIn, setNextRefreshIn] = useState<number | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            router.refresh();
            setLastRefresh(new Date());
            onUpdate?.();
        } finally {
            // Small delay to show visual feedback
            setTimeout(() => setIsRefreshing(false), 500);
        }
    }, [router, onUpdate]);

    // Start countdown timer
    useEffect(() => {
        if (!enabled) {
            setNextRefreshIn(null);
            return;
        }

        let secondsRemaining = Math.floor(interval / 1000);
        setNextRefreshIn(secondsRemaining);

        countdownRef.current = setInterval(() => {
            secondsRemaining -= 1;
            if (secondsRemaining > 0) {
                setNextRefreshIn(secondsRemaining);
            } else {
                secondsRemaining = Math.floor(interval / 1000);
                setNextRefreshIn(secondsRemaining);
            }
        }, 1000);

        return () => {
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
            }
        };
    }, [enabled, interval, lastRefresh]);

    // Main polling interval
    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            return;
        }

        intervalRef.current = setInterval(() => {
            refresh();
        }, interval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, interval, refresh]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, []);

    return {
        refresh,
        isRefreshing,
        lastRefresh,
        nextRefreshIn
    };
}

/**
 * Format seconds to human-readable string
 */
export function formatRefreshTime(seconds: number | null): string {
    if (seconds === null) return '';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
