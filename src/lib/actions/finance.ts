'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { formatCurrency } from '@/lib/utils'

// ==================== COMPANY-WIDE FINANCE DATA ====================

/**
 * Get comprehensive company-wide financial overview
 * Combines data from inventory, trucks, fuel, and production
 */
export async function getCompanyFinancials() {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    // Only Manager, Accountant, Super Admin can access
    const allowedRoles = ['Super Admin', 'Manager', 'Accountant']
    if (!allowedRoles.includes(session.user.role)) {
        throw new Error('Access denied: Finance data is restricted')
    }

    // Parallel fetch all data
    const [
        inventoryData,
        fuelData,
        maintenanceData,
        sparePartsData,
        productionData,
        recentTransactions
    ] = await Promise.all([
        // Inventory valuation
        prisma.inventoryItem.aggregate({
            where: { status: 'Active' },
            _sum: { totalValue: true, quantity: true },
            _count: true
        }),

        // Fuel costs (last 30 days)
        prisma.fuelLog.aggregate({
            where: {
                date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            },
            _sum: { cost: true, liters: true },
            _count: true
        }),

        // Maintenance costs (last 30 days)
        prisma.maintenanceRecord.aggregate({
            where: {
                date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            },
            _sum: { cost: true },
            _count: true
        }),

        // Spare parts inventory value
        prisma.sparePartInventory.aggregate({
            _sum: { quantity: true },
            _count: true
        }),

        // Production runs (last 30 days)
        prisma.productionRun.count({
            where: {
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
        }),

        // Recent stock transactions with cost
        prisma.stockTransaction.findMany({
            where: {
                status: 'Approved',
                totalCost: { not: null },
                createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            },
            include: {
                item: { include: { location: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        })
    ])

    // Calculate stock in/out values
    const stockInValue = recentTransactions
        .filter(t => t.type === 'IN')
        .reduce((sum, t) => sum + (t.totalCost || 0), 0)

    const stockOutValue = recentTransactions
        .filter(t => t.type === 'OUT')
        .reduce((sum, t) => sum + (t.totalCost || 0), 0)

    return {
        // Summary metrics
        summary: {
            totalInventoryValue: inventoryData._sum.totalValue || 0,
            inventoryItemCount: inventoryData._count,
            fuelCostLast30Days: fuelData._sum.cost || 0,
            fuelLitersLast30Days: fuelData._sum.liters || 0,
            maintenanceCostLast30Days: maintenanceData._sum.cost || 0,
            maintenanceRecordCount: maintenanceData._count,
            sparePartsCount: sparePartsData._count,
            productionRunsLast30Days: productionData,
            stockInValueLast30Days: stockInValue,
            stockOutValueLast30Days: stockOutValue,
            netStockValueLast30Days: stockInValue - stockOutValue
        },

        // Recent transactions for display
        recentTransactions: recentTransactions.map(t => ({
            id: t.id,
            type: t.type,
            itemName: t.item.name,
            location: t.item.location.name,
            quantity: t.quantity,
            unit: t.item.unit,
            totalCost: t.totalCost,
            supplierName: t.supplierName,
            createdAt: t.createdAt
        }))
    }
}

/**
 * Get inventory breakdown by category and location
 */
export async function getInventoryBreakdown() {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const allowedRoles = ['Super Admin', 'Manager', 'Accountant']
    if (!allowedRoles.includes(session.user.role)) {
        throw new Error('Access denied')
    }

    const items = await prisma.inventoryItem.findMany({
        where: { status: 'Active' },
        include: { location: true }
    })

    // Group by category
    const byCategory = items.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = { count: 0, value: 0, quantity: 0 }
        }
        acc[item.category].count += 1
        acc[item.category].value += item.totalValue
        acc[item.category].quantity += item.quantity
        return acc
    }, {} as Record<string, { count: number; value: number; quantity: number }>)

    // Group by location
    const byLocation = items.reduce((acc, item) => {
        const locName = item.location.name
        if (!acc[locName]) {
            acc[locName] = { count: 0, value: 0, type: item.location.type }
        }
        acc[locName].count += 1
        acc[locName].value += item.totalValue
        return acc
    }, {} as Record<string, { count: number; value: number; type: string }>)

    const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0)

    // Top 10 items by value
    const topItems = items
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10)
        .map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unitCost,
            totalValue: item.totalValue,
            location: item.location.name
        }))

    return {
        totalValue,
        totalItems: items.length,
        byCategory: Object.entries(byCategory).map(([name, data]) => ({
            name,
            ...data,
            percentageOfTotal: totalValue > 0 ? (data.value / totalValue) * 100 : 0
        })),
        byLocation: Object.entries(byLocation).map(([name, data]) => ({
            name,
            ...data,
            percentageOfTotal: totalValue > 0 ? (data.value / totalValue) * 100 : 0
        })),
        topItems
    }
}

/**
 * Get fuel cost breakdown
 */
export async function getFuelCostBreakdown(period: '7days' | '30days' | '90days' = '30days') {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const allowedRoles = ['Super Admin', 'Manager', 'Accountant']
    if (!allowedRoles.includes(session.user.role)) {
        throw new Error('Access denied')
    }

    const days = period === '7days' ? 7 : period === '30days' ? 30 : 90
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const logs = await prisma.fuelLog.findMany({
        where: { date: { gte: startDate } },
        include: { truck: true },
        orderBy: { date: 'desc' }
    })

    // By truck
    const byTruck = logs.reduce((acc, log) => {
        const truckName = log.truck?.plateNumber
        if (!truckName) return acc
        if (!acc[truckName]) {
            acc[truckName] = { cost: 0, liters: 0, refills: 0 }
        }
        acc[truckName].cost += log.cost
        acc[truckName].liters += log.liters
        acc[truckName].refills += 1
        return acc
    }, {} as Record<string, { cost: number; liters: number; refills: number }>)

    // Daily breakdown
    const dailyData: { date: string; cost: number; liters: number }[] = []
    for (let i = Math.min(days, 14) - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        const dayStart = new Date(date.setHours(0, 0, 0, 0))
        const dayEnd = new Date(date.setHours(23, 59, 59, 999))

        const dayLogs = logs.filter(l =>
            new Date(l.date) >= dayStart && new Date(l.date) <= dayEnd
        )

        dailyData.push({
            date: dateStr,
            cost: dayLogs.reduce((sum, l) => sum + l.cost, 0),
            liters: dayLogs.reduce((sum, l) => sum + l.liters, 0)
        })
    }

    const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)
    const totalLiters = logs.reduce((sum, l) => sum + l.liters, 0)

    return {
        period: { days, startDate, endDate: new Date() },
        summary: {
            totalCost,
            totalLiters,
            avgCostPerLiter: totalLiters > 0 ? totalCost / totalLiters : 0,
            refillCount: logs.length
        },
        byTruck: Object.entries(byTruck)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.cost - a.cost),
        dailyData,
        recentLogs: logs.slice(0, 10).map(l => ({
            id: l.id,
            truckName: l.truck?.plateNumber ?? 'Equipment',
            liters: l.liters,
            cost: l.cost,
            date: l.date
        }))
    }
}

/**
 * Get maintenance cost breakdown
 */
export async function getMaintenanceCostBreakdown(period: '30days' | '90days' | 'year' = '30days') {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const allowedRoles = ['Super Admin', 'Manager', 'Accountant']
    if (!allowedRoles.includes(session.user.role)) {
        throw new Error('Access denied')
    }

    const days = period === '30days' ? 30 : period === '90days' ? 90 : 365
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const records = await prisma.maintenanceRecord.findMany({
        where: { date: { gte: startDate } },
        include: { truck: true },
        orderBy: { date: 'desc' }
    })

    // By truck
    const byTruck = records.reduce((acc, rec) => {
        const truckName = rec.truck.plateNumber
        if (!acc[truckName]) {
            acc[truckName] = { cost: 0, count: 0 }
        }
        acc[truckName].cost += rec.cost
        acc[truckName].count += 1
        return acc
    }, {} as Record<string, { cost: number; count: number }>)

    // By type
    const byType = records.reduce((acc, rec) => {
        if (!acc[rec.type]) {
            acc[rec.type] = { cost: 0, count: 0 }
        }
        acc[rec.type].cost += rec.cost
        acc[rec.type].count += 1
        return acc
    }, {} as Record<string, { cost: number; count: number }>)

    const totalCost = records.reduce((sum, r) => sum + r.cost, 0)

    return {
        period: { days, startDate, endDate: new Date() },
        summary: {
            totalCost,
            recordCount: records.length,
            avgCostPerRecord: records.length > 0 ? totalCost / records.length : 0
        },
        byTruck: Object.entries(byTruck)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.cost - a.cost),
        byType: Object.entries(byType)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.cost - a.cost),
        recentRecords: records.slice(0, 10).map(r => ({
            id: r.id,
            truckName: r.truck.plateNumber,
            type: r.type,
            notes: r.notes,
            cost: r.cost,
            date: r.date
        }))
    }
}

/**
 * Export comprehensive finance report as CSV
 */
export async function exportFinanceReportCSV() {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const allowedRoles = ['Super Admin', 'Manager', 'Accountant']
    if (!allowedRoles.includes(session.user.role)) {
        throw new Error('Access denied')
    }

    const [financials, inventory, fuel, maintenance] = await Promise.all([
        getCompanyFinancials(),
        getInventoryBreakdown(),
        getFuelCostBreakdown('30days'),
        getMaintenanceCostBreakdown('30days')
    ])

    const lines: string[] = []

    // Header
    lines.push('Wet N Dry Ltd - Financial Report')
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push(`Generated By: ${session.user.name || 'Unknown'}`)
    lines.push('')

    // Summary Section
    lines.push('=== COMPANY FINANCIAL SUMMARY (Last 30 Days) ===')
    lines.push('')
    lines.push('Category,Value')
    lines.push(`Total Inventory Value,${formatCurrency(financials.summary.totalInventoryValue)}`)
    lines.push(`Stock In Value,${formatCurrency(financials.summary.stockInValueLast30Days)}`)
    lines.push(`Stock Out Value,${formatCurrency(financials.summary.stockOutValueLast30Days)}`)
    lines.push(`Net Stock Movement,${formatCurrency(financials.summary.netStockValueLast30Days)}`)
    lines.push(`Fuel Costs,${formatCurrency(financials.summary.fuelCostLast30Days)}`)
    lines.push(`Maintenance Costs,${formatCurrency(financials.summary.maintenanceCostLast30Days)}`)
    lines.push('')

    // Inventory breakdown
    lines.push('=== INVENTORY BY CATEGORY ===')
    lines.push('')
    lines.push('Category,Item Count,Total Value,Percentage')
    inventory.byCategory.forEach(cat => {
        lines.push(`"${cat.name}",${cat.count},${formatCurrency(cat.value)},${cat.percentageOfTotal.toFixed(1)}%`)
    })
    lines.push('')

    // Fuel by truck
    lines.push('=== FUEL COSTS BY TRUCK ===')
    lines.push('')
    lines.push('Truck,Cost,Liters,Refills')
    fuel.byTruck.forEach(t => {
        lines.push(`"${t.name}",${formatCurrency(t.cost)},${t.liters.toFixed(1)},${t.refills}`)
    })
    lines.push('')

    // Maintenance by type
    lines.push('=== MAINTENANCE BY TYPE ===')
    lines.push('')
    lines.push('Type,Count,Total Cost')
    maintenance.byType.forEach(t => {
        lines.push(`"${t.name}",${t.count},${formatCurrency(t.cost)}`)
    })

    return lines.join('\n')
}
