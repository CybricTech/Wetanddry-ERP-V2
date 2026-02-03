import React from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hasPermission } from '@/lib/permissions'
import { getOrders } from '@/lib/actions/orders'
import { getClientsForSelect } from '@/lib/actions/crm'
import { getRecipes } from '@/lib/actions/production'
import { getProjectsForSelect } from '@/lib/actions/projects'
import OrdersClient from '@/components/orders/OrdersClient'

export const revalidate = 30

export default async function OrdersPage() {
    const session = await auth()

    if (!session?.user) {
        redirect('/login')
    }

    const userRole = session.user.role
    if (!userRole || !hasPermission(userRole, 'view_orders')) {
        redirect('/dashboard')
    }

    // Fetch initial data
    let orders: any = { orders: [], stats: {} }
    let clients: any[] = []
    let recipes: any[] = []
    let projects: any[] = []

    try {
        [orders, clients, recipes, projects] = await Promise.all([
            getOrders(),
            getClientsForSelect(),
            getRecipes(),
            getProjectsForSelect()
        ])
    } catch (error) {
        console.error('[Orders Page] Failed to load data:', error)
    }

    return (
        <OrdersClient
            initialOrders={orders.orders}
            initialStats={orders.stats}
            clients={clients}
            recipes={recipes}
            projects={projects}
            userRole={userRole}
            userName={session.user.name || 'User'}
        />
    )
}
