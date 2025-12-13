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

    // Check permission - use the actual role string
    const userRole = session.user.role
    console.log('[CRM Page] User role:', userRole)
    
    if (!userRole || !hasPermission(userRole, 'view_crm')) {
        console.log('[CRM Page] Permission denied for role:', userRole)
        redirect('/dashboard')
    }

    // Fetch initial data with error handling
    let clients: any[] = []
    try {
        clients = await getClients()
        console.log('[CRM Page] Loaded', clients.length, 'clients')
    } catch (error) {
        console.error('[CRM Page] Failed to load clients:', error)
        // Continue with empty clients rather than crashing
        clients = []
    }

    return (
        <CRMClient
            initialClients={clients}
            userRole={userRole}
            userName={session.user.name || 'User'}
        />
    )
}
