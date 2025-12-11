'use client';

import { SessionProvider } from 'next-auth/react';

export default function NextAuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider
            // Refetch session every 30 seconds to catch role changes faster
            refetchInterval={30}
            // Always refetch when window gains focus
            refetchOnWindowFocus={true}
            // Refetch when coming back online
            refetchWhenOffline={false}
        >
            {children}
        </SessionProvider>
    );
}
