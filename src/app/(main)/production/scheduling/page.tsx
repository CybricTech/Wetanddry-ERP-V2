import React from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { getScheduledRuns, getRecipes, getSilos } from '@/lib/actions/production'
import { getClientsForSelect } from '@/lib/actions/crm'
import SchedulingClient from '@/components/production/SchedulingClient'

export const revalidate = 30

export default async function SchedulingPage() {
    const session = await auth()

    if (!session?.user) {
        redirect('/login')
    }

    const userRole = session.user.role
    if (!userRole || !hasPermission(userRole, 'log_production')) {
        redirect('/dashboard')
    }

    let scheduledRuns: any[] = []
    let recipes: any[] = []
    let silos: any[] = []
    let clients: any[] = []

    try {
        [scheduledRuns, recipes, silos, clients] = await Promise.all([
            getScheduledRuns(),
            getRecipes(),
            getSilos(),
            getClientsForSelect()
        ])
    } catch (error) {
        console.error('[Scheduling Page] Failed to load data:', error)
    }

    return (
        <SchedulingClient
            initialRuns={scheduledRuns}
            recipes={recipes}
            silos={silos}
            clients={clients}
            userRole={userRole}
            userName={session.user.name || 'User'}
        />
    )
}
