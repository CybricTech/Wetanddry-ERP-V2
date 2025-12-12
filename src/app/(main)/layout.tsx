import React from 'react';
import { Sidebar } from '@/components/Layout/Sidebar';
import { Header } from '@/components/Layout/Header';
import { auth } from '@/auth';

// Allow caching but revalidate session every 60 seconds
// Session cookies are still checked on each request by NextAuth middleware
export const revalidate = 60;

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar user={session?.user} />
            <div className="flex-1 flex flex-col min-w-0">
                <Header session={session} />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
