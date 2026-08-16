import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import SettingsNav from '@/components/settings/SettingsNav'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()
    if (!session?.user) redirect('/login')

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div>
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-500 mt-1">Manage your account and system preferences</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-6">
                    <SettingsNav permissions={session.user.permissions ?? []} />
                    <div className="flex-1 min-w-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
