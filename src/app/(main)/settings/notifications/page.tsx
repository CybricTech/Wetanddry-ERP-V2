import NotificationSettings from '@/components/notifications/NotificationSettings'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function NotificationSettingsPage() {
    const session = await auth()

    if (!session?.user) {
        redirect('/login')
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
                    <p className="text-gray-500 mt-1">
                        Manage how and when you receive notifications
                    </p>
                </div>

                <NotificationSettings />
            </div>
        </div>
    )
}
