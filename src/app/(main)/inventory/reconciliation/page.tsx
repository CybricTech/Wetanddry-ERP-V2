import React from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { getReconciliations } from '@/lib/actions/reconciliation'
import { getStorageLocations } from '@/lib/actions/inventory'
import ReconciliationClient from '@/components/inventory/ReconciliationClient'

export const revalidate = 30

export default async function ReconciliationPage() {
    const session = await auth()

    if (!session?.user) {
        redirect('/login')
    }

    const userRole = session.user.role
    if (!userRole || !hasPermission(userRole, 'approve_stock_transactions')) {
        redirect('/dashboard')
    }

    let reconciliations: any[] = []
    let locations: any[] = []

    try {
        [reconciliations, locations] = await Promise.all([
            getReconciliations(),
            getStorageLocations()
        ])
    } catch (error) {
        console.error('[Reconciliation Page] Failed to load data:', error)
    }

    return (
        <ReconciliationClient
            initialReconciliations={reconciliations}
            locations={locations}
            userRole={userRole}
            userName={session.user.name || 'User'}
        />
    )
}
