'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { hasPermission, type Permission } from '@/lib/permissions'

/**
 * Everything waiting on the current user across every module, in one list.
 *
 * Each source is gated on the approve permission that governs it, so a user only ever
 * sees what they can actually act on. The items carry a `href` rather than their own
 * approve/reject controls: each module already owns that UI, and duplicating it here
 * would mean two places to keep correct.
 */

export type PendingApprovalKind =
    | 'inventory_item'
    | 'stock_transaction'
    | 'material_request'
    | 'maintenance_record'
    | 'maintenance_schedule'
    | 'fuel_request'
    | 'fuel_log_edit'

export interface PendingApprovalEntry {
    id: string
    kind: PendingApprovalKind
    module: 'Inventory' | 'Fleet' | 'Fuel'
    title: string
    detail: string
    requestedBy: string | null
    createdAt: Date
    href: string
}

export async function getAllPendingApprovals(): Promise<{
    entries: PendingApprovalEntry[]
    counts: Record<string, number>
    total: number
}> {
    const session = await auth()
    const role = session?.user?.role

    if (!role) {
        return { entries: [], counts: {}, total: 0 }
    }

    const can = (permission: Permission) => hasPermission(role, permission)

    const [items, transactions, materialRequests, records, schedules, fuelRequests, fuelLogEdits] = await Promise.all([
        can('approve_inventory_items')
            ? prisma.inventoryItem.findMany({
                  where: { status: 'Pending' },
                  include: { location: true },
                  orderBy: { createdAt: 'desc' },
              })
            : [],
        can('approve_stock_transactions')
            ? prisma.stockTransaction.findMany({
                  where: { status: 'Pending' },
                  include: { item: true },
                  orderBy: { createdAt: 'desc' },
              })
            : [],
        can('approve_material_requests')
            ? prisma.materialRequest.findMany({
                  where: { status: 'Pending' },
                  include: { item: true },
                  orderBy: { createdAt: 'desc' },
              })
            : [],
        can('approve_maintenance')
            ? prisma.maintenanceRecord.findMany({
                  where: { approvalStatus: 'Pending' },
                  include: { truck: true },
                  orderBy: { createdAt: 'desc' },
              })
            : [],
        can('approve_maintenance')
            ? prisma.maintenanceSchedule.findMany({
                  where: { approvalStatus: 'Pending' },
                  include: { truck: true },
                  orderBy: { createdAt: 'desc' },
              })
            : [],
        can('approve_fuel_requests')
            ? prisma.fuelRequest.findMany({
                  where: { status: 'Pending' },
                  include: { truck: true, equipment: true },
                  orderBy: { createdAt: 'desc' },
              })
            : [],
        can('approve_fuel_requests')
            ? prisma.editRequest.findMany({
                  where: { entityType: 'fuel_log', status: 'Pending' },
                  orderBy: { createdAt: 'desc' },
              })
            : [],
    ])

    const entries: PendingApprovalEntry[] = [
        ...items.map(item => ({
            id: item.id,
            kind: 'inventory_item' as const,
            module: 'Inventory' as const,
            title: `New item: ${item.name}`,
            detail: `${item.quantity} ${item.unit} in ${item.location.name}`,
            requestedBy: item.createdBy,
            createdAt: item.createdAt,
            href: '/inventory',
        })),
        ...transactions.map(transaction => ({
            id: transaction.id,
            kind: 'stock_transaction' as const,
            module: 'Inventory' as const,
            title: `Stock ${transaction.type}: ${transaction.item.name}`,
            detail: `${transaction.quantity} ${transaction.item.unit}${transaction.reason ? ` - ${transaction.reason}` : ''}`,
            requestedBy: transaction.performedBy,
            createdAt: transaction.createdAt,
            href: '/inventory',
        })),
        ...materialRequests.map(request => ({
            id: request.id,
            kind: 'material_request' as const,
            module: 'Inventory' as const,
            title: `${request.requestType}: ${request.item.name}`,
            detail: `${request.quantity} ${request.item.unit}${request.reason ? ` - ${request.reason}` : ''}`,
            requestedBy: request.requestedBy,
            createdAt: request.createdAt,
            href: '/inventory',
        })),
        ...records.map(record => ({
            id: record.id,
            kind: 'maintenance_record' as const,
            module: 'Fleet' as const,
            title: `Maintenance: ${record.truck.plateNumber}`,
            detail: `${record.type} - ${record.cost.toLocaleString()}`,
            requestedBy: record.requestedBy,
            createdAt: record.createdAt,
            href: `/trucks/${record.truckId}`,
        })),
        ...schedules.map(schedule => ({
            id: schedule.id,
            kind: 'maintenance_schedule' as const,
            module: 'Fleet' as const,
            title: `Service schedule: ${schedule.truck.plateNumber}`,
            detail: `${schedule.type} - ${schedule.priority} priority`,
            requestedBy: schedule.requestedBy,
            createdAt: schedule.createdAt,
            href: `/trucks/${schedule.truckId}`,
        })),
        ...fuelRequests.map(request => ({
            id: request.id,
            kind: 'fuel_request' as const,
            module: 'Fuel' as const,
            title: `Fuel: ${request.truck?.plateNumber ?? request.equipment?.name ?? 'request'}`,
            detail: `${request.liters} L${request.purpose ? ` - ${request.purpose}` : ''}`,
            requestedBy: request.requestedBy,
            createdAt: request.createdAt,
            href: '/fuel',
        })),
        ...fuelLogEdits.map(edit => ({
            id: edit.id,
            kind: 'fuel_log_edit' as const,
            module: 'Fuel' as const,
            title: edit.operation === 'delete' ? 'Fuel log deletion' : 'Fuel log edit',
            detail: `${(edit.previousValues as { liters?: number } | null)?.liters ?? '?'} L record - ${edit.operation === 'delete' ? 'deletion' : 'change'} awaiting approval`,
            requestedBy: edit.requestedBy,
            createdAt: edit.createdAt,
            href: '/fuel',
        })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    const counts = entries.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.kind] = (acc[entry.kind] ?? 0) + 1
        return acc
    }, {})

    return { entries, counts, total: entries.length }
}
