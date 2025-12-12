import React from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { getClients } from '@/lib/actions/crm'
import CRMClient from '@/components/crm/CRMClient'

// Revalidate every 30 seconds
export const revalidate = 30

export default async function CRMPage() {
    const session = await auth()

    if (!session?.user) {
        redirect('/login')
    }

    // Check permission
    const userRole = session.user.role || 'Storekeeper'
    if (!hasPermission(userRole, 'view_crm')) {
        redirect('/dashboard')
    }

    // Fetch initial data
    const clients = await getClients()

    return (
        <CRMClient
            initialClients={clients as any}
            userRole={userRole}
            userName={session.user.name || 'User'}
        />
    )
}
