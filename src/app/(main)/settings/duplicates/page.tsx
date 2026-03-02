import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getDuplicateAlerts } from '@/lib/actions/duplicates'
import DuplicateAlertsClient from '@/components/duplicates/DuplicateAlertsClient'

export default async function DuplicatesPage() {
    const session = await auth()
    if (!session?.user?.role || session.user.role !== 'Super Admin') {
        redirect('/dashboard')
    }

    const { alerts, pagination } = await getDuplicateAlerts('Open')

    return (
        <DuplicateAlertsClient
            initialAlerts={alerts}
            initialPagination={pagination}
        />
    )
}
