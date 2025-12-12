'use server'

import prisma from '@/lib/prisma';
import { Role, ROLE_PERMISSIONS, Permission } from '@/lib/permissions';
import { auth } from '@/auth';
import { sendPushNotification } from '@/lib/web-push';

// ==================== NOTIFICATION TYPES ====================

export type NotificationType =
    // Approval Requests
    | 'new_inventory_item'
    | 'stock_transaction_pending'
    | 'material_request_pending'
    // Approval Decisions
    | 'item_approved'
    | 'item_rejected'
    | 'transaction_approved'
    | 'transaction_rejected'
    | 'request_approved'
    | 'request_rejected'
    // Inventory Alerts
    | 'low_stock_alert'
    | 'silo_level_critical'
    // Fleet & Maintenance
    | 'maintenance_due_date'
    | 'maintenance_due_mileage'
    | 'document_expiring'
    | 'spare_parts_low'
    // Exceptions
    | 'new_exception'
    | 'exception_resolved'
    // Production
    | 'production_completed'
    | 'material_shortage'
    // System
    | 'user_created'
    | 'role_changed';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface CreateNotificationInput {
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    userId: string;
    entityType?: string;
    entityId?: string;
}

// Notification type configuration - matches User's Notification Matrix
const NOTIFICATION_CONFIG: Record<NotificationType, {
    defaultPriority: NotificationPriority;
    requiredPermissions?: Permission[]; // Who can receive this type
    targetRoles?: Role[]; // Alternative: specific roles
}> = {
    // Approval requests → Super Admin, Manager
    new_inventory_item: { defaultPriority: 'high', requiredPermissions: ['approve_inventory_items'] },
    stock_transaction_pending: { defaultPriority: 'high', requiredPermissions: ['approve_stock_transactions'] },
    material_request_pending: { defaultPriority: 'medium', requiredPermissions: ['approve_material_requests'] },

    // Approval decisions → Original Requester (handled specially via notifyRequester)
    item_approved: { defaultPriority: 'high' },
    item_rejected: { defaultPriority: 'high' },
    transaction_approved: { defaultPriority: 'high' },
    transaction_rejected: { defaultPriority: 'high' },
    request_approved: { defaultPriority: 'high' },
    request_rejected: { defaultPriority: 'high' },

    // Inventory Alerts → Super Admin, Manager, Storekeeper (all have view_inventory)
    low_stock_alert: { defaultPriority: 'critical', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER, Role.STOREKEEPER] },
    silo_level_critical: { defaultPriority: 'critical', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER, Role.STOREKEEPER] },

    // Fleet & Maintenance → Super Admin, Manager
    maintenance_due_date: { defaultPriority: 'high', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },
    maintenance_due_mileage: { defaultPriority: 'high', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },
    document_expiring: { defaultPriority: 'medium', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },
    spare_parts_low: { defaultPriority: 'medium', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },

    // Exceptions → new_exception to Super Admin, Manager; resolved to all with view_exceptions
    new_exception: { defaultPriority: 'high', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },
    exception_resolved: { defaultPriority: 'low', requiredPermissions: ['view_exceptions'] },

    // Production → completed to Super Admin, Manager; shortage to SA, Manager, Storekeeper
    production_completed: { defaultPriority: 'low', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },
    material_shortage: { defaultPriority: 'high', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER, Role.STOREKEEPER] },

    // System/Admin → Super Admin only
    user_created: { defaultPriority: 'low', targetRoles: [Role.SUPER_ADMIN] },
    role_changed: { defaultPriority: 'medium', targetRoles: [Role.SUPER_ADMIN] },
};


// ==================== CORE NOTIFICATION ACTIONS ====================

// Create a single notification for a specific user
export async function createNotification(input: CreateNotificationInput) {
    const config = NOTIFICATION_CONFIG[input.type];
    const priority = input.priority || config?.defaultPriority || 'medium';

    try {
        const notification = await prisma.notification.create({
            data: {
                type: input.type,
                title: input.title,
                message: input.message,
                priority,
                userId: input.userId,
                entityType: input.entityType,
                entityId: input.entityId,
            },
        });

        // Send push notification in the background (non-blocking)
        sendPushNotification(input.userId, {
            title: input.title,
            body: input.message,
            priority: priority as 'low' | 'medium' | 'high' | 'critical',
            data: {
                type: input.type,
                entityType: input.entityType,
                entityId: input.entityId,
                notificationId: notification.id,
            },
        }).catch(err => {
            // Log but don't fail the notification creation
            console.log('[Notifications] Push notification failed (non-critical):', err.message || err);
        });

        return { success: true, notification };
    } catch (error) {
        console.error('Failed to create notification:', error);
        return { success: false, error: 'Failed to create notification' };
    }
}

// Create notifications for all users with a specific permission
export async function notifyByPermission(
    permission: Permission,
    notification: Omit<CreateNotificationInput, 'userId'>
) {
    try {
        // Find all roles that have this permission
        const rolesWithPermission = Object.entries(ROLE_PERMISSIONS)
            .filter(([_, permissions]) => permissions.includes(permission))
            .map(([role]) => role);

        // Get all users with those roles
        const users = await prisma.user.findMany({
            where: {
                role: { in: rolesWithPermission },
            },
            select: { id: true },
        });

        // Create notifications for each user
        const notifications = await Promise.all(
            users.map((user) =>
                createNotification({
                    ...notification,
                    userId: user.id,
                })
            )
        );

        return { success: true, count: notifications.length };
    } catch (error) {
        console.error('Failed to notify by permission:', error);
        return { success: false, error: 'Failed to create notifications' };
    }
}

// Create notifications for all users with specific roles
export async function notifyByRole(
    roles: Role[],
    notification: Omit<CreateNotificationInput, 'userId'>
) {
    try {
        const users = await prisma.user.findMany({
            where: {
                role: { in: roles },
            },
            select: { id: true },
        });

        const notifications = await Promise.all(
            users.map((user) =>
                createNotification({
                    ...notification,
                    userId: user.id,
                })
            )
        );

        return { success: true, count: notifications.length };
    } catch (error) {
        console.error('Failed to notify by role:', error);
        return { success: false, error: 'Failed to create notifications' };
    }
}

// Get notifications for the current user
export async function getMyNotifications(limit = 20, includeRead = false) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            console.warn('[Notifications] getMyNotifications called without valid session');
            return { success: false, error: 'Not authenticated', notifications: [] };
        }

        const notifications = await prisma.notification.findMany({
            where: {
                userId: session.user.id,
                ...(includeRead ? {} : { read: false }),
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return { success: true, notifications };
    } catch (error) {
        console.error('[Notifications] Failed to get notifications:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notifications';
        return { success: false, error: errorMessage, notifications: [] };
    }
}

// Get unread count for badge
export async function getUnreadCount() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return 0;
        }

        const count = await prisma.notification.count({
            where: {
                userId: session.user.id,
                read: false,
            },
        });

        return count;
    } catch (error) {
        console.error('[Notifications] Failed to get unread count:', error);
        return 0;
    }
}

// Mark notification(s) as read
export async function markAsRead(notificationIds: string | string[]) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' };
    }

    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];

    try {
        await prisma.notification.updateMany({
            where: {
                id: { in: ids },
                userId: session.user.id, // Security: only mark own notifications
            },
            data: {
                read: true,
                readAt: new Date(),
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to mark as read:', error);
        return { success: false, error: 'Failed to update notification' };
    }
}

// Mark all as read
export async function markAllAsRead() {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' };
    }

    try {
        await prisma.notification.updateMany({
            where: {
                userId: session.user.id,
                read: false,
            },
            data: {
                read: true,
                readAt: new Date(),
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to mark all as read:', error);
        return { success: false, error: 'Failed to update notifications' };
    }
}

// Test push notification - for debugging
export async function testPushNotificationForCurrentUser() {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' };
    }

    const result = await sendPushNotification(session.user.id, {
        title: '🔔 Test Notification',
        body: 'Push notifications are working! You will receive alerts even when the app is in the background.',
        priority: 'medium',
        data: {
            type: 'test',
            url: '/dashboard',
        },
    });

    return result;
}

// Delete old notifications (cleanup - can be called via cron)
export async function cleanupOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
        const result = await prisma.notification.deleteMany({
            where: {
                createdAt: { lt: cutoffDate },
                read: true,
            },
        });

        return { success: true, deleted: result.count };
    } catch (error) {
        console.error('Failed to cleanup notifications:', error);
        return { success: false, error: 'Cleanup failed' };
    }
}

// ==================== PUSH NOTIFICATION PREFERENCES ====================

export async function getPushPreference() {
    const session = await auth();
    if (!session?.user?.id) {
        return null;
    }

    try {
        const pref = await prisma.userNotificationPreference.findUnique({
            where: { userId: session.user.id },
        });
        return pref;
    } catch (error) {
        console.error('Failed to get push preference:', error);
        return null;
    }
}

export async function updatePushSubscription(subscription: string | null, enabled: boolean) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' };
    }

    try {
        await prisma.userNotificationPreference.upsert({
            where: { userId: session.user.id },
            update: {
                pushEnabled: enabled,
                pushSubscription: subscription,
            },
            create: {
                userId: session.user.id,
                pushEnabled: enabled,
                pushSubscription: subscription,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to update push subscription:', error);
        return { success: false, error: 'Failed to save preference' };
    }
}

export async function updateNotificationPreferences(preferences: Record<string, { inApp: boolean; push: boolean }>) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated' };
    }

    try {
        await prisma.userNotificationPreference.upsert({
            where: { userId: session.user.id },
            update: {
                preferences: JSON.stringify(preferences),
            },
            create: {
                userId: session.user.id,
                preferences: JSON.stringify(preferences),
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to update preferences:', error);
        return { success: false, error: 'Failed to save preferences' };
    }
}

// ==================== TRIGGER HELPERS ====================
// These are convenience functions to trigger notifications from other server actions

export async function notifyApprovers(
    type: 'new_inventory_item' | 'stock_transaction_pending' | 'material_request_pending',
    title: string,
    message: string,
    entityType: string,
    entityId: string
) {
    const config = NOTIFICATION_CONFIG[type];
    if (config.requiredPermissions) {
        return notifyByPermission(config.requiredPermissions[0], {
            type,
            title,
            message,
            priority: config.defaultPriority,
            entityType,
            entityId,
        });
    }
}

export async function notifyRequester(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    entityType?: string,
    entityId?: string
) {
    return createNotification({
        type,
        title,
        message,
        userId,
        entityType,
        entityId,
    });
}

// ==================== INVENTORY ALERT TRIGGERS ====================

// Check and notify for low stock items
export async function checkAndNotifyLowStock(itemId?: string) {
    try {
        const whereClause = itemId
            ? { id: itemId, status: 'Active' }
            : { status: 'Active' };

        const items = await prisma.inventoryItem.findMany({
            where: whereClause,
            include: { location: true }
        });

        const lowStockItems = items.filter(item => item.quantity <= item.minThreshold);

        for (const item of lowStockItems) {
            const config = NOTIFICATION_CONFIG.low_stock_alert;
            await notifyByRole(config.targetRoles!, {
                type: 'low_stock_alert',
                title: `Low Stock Alert: ${item.name}`,
                message: `${item.name} is below minimum threshold. Current: ${item.quantity.toLocaleString()} ${item.unit}, Minimum: ${item.minThreshold.toLocaleString()} ${item.unit}`,
                priority: 'critical',
                entityType: 'inventory_item',
                entityId: item.id,
            });
        }

        return { success: true, alertsSent: lowStockItems.length };
    } catch (error) {
        console.error('[Notifications] Failed to check low stock:', error);
        return { success: false, error: 'Failed to check low stock' };
    }
}

// Check and notify for critical silo levels (< 20%)
export async function checkAndNotifySiloCritical(siloId?: string) {
    try {
        const whereClause = siloId
            ? { id: siloId, type: 'Silo', isActive: true }
            : { type: 'Silo', isActive: true };

        const silos = await prisma.storageLocation.findMany({
            where: whereClause,
            include: { items: { where: { itemType: 'Cement' } } }
        });

        let alertsSent = 0;

        for (const silo of silos) {
            const cementItem = silo.items[0];
            if (!cementItem) continue;

            const maxCapacity = cementItem.maxCapacity || silo.capacity || 95000;
            const percentage = (cementItem.quantity / maxCapacity) * 100;

            if (percentage < 20) {
                const config = NOTIFICATION_CONFIG.silo_level_critical;
                await notifyByRole(config.targetRoles!, {
                    type: 'silo_level_critical',
                    title: `Critical Silo Level: ${silo.name}`,
                    message: `${silo.name} cement level is critically low at ${percentage.toFixed(1)}%. Current: ${cementItem.quantity.toLocaleString()} ${cementItem.unit}`,
                    priority: 'critical',
                    entityType: 'inventory_item',
                    entityId: cementItem.id,
                });
                alertsSent++;
            }
        }

        return { success: true, alertsSent };
    } catch (error) {
        console.error('[Notifications] Failed to check silo levels:', error);
        return { success: false, error: 'Failed to check silo levels' };
    }
}

// ==================== EXCEPTION TRIGGERS ====================

export async function notifyNewException(
    exceptionId: string,
    type: string,
    reason: string,
    quantity: number
) {
    const config = NOTIFICATION_CONFIG.new_exception;
    return notifyByRole(config.targetRoles!, {
        type: 'new_exception',
        title: `New Exception: ${type}`,
        message: `A ${type.toLowerCase()} of ${quantity} m³ has been reported. Reason: ${reason}`,
        priority: config.defaultPriority,
        entityType: 'exception',
        entityId: exceptionId,
    });
}

export async function notifyExceptionResolved(exceptionId: string, type: string) {
    const config = NOTIFICATION_CONFIG.exception_resolved;
    return notifyByPermission(config.requiredPermissions![0], {
        type: 'exception_resolved',
        title: `Exception Resolved: ${type}`,
        message: `The ${type.toLowerCase()} exception has been marked as resolved.`,
        priority: config.defaultPriority,
        entityType: 'exception',
        entityId: exceptionId,
    });
}

// ==================== PRODUCTION TRIGGERS ====================

export async function notifyProductionCompleted(
    runId: string,
    recipeName: string,
    quantity: number,
    operatorName: string
) {
    const config = NOTIFICATION_CONFIG.production_completed;
    return notifyByRole(config.targetRoles!, {
        type: 'production_completed',
        title: `Production Completed: ${recipeName}`,
        message: `${quantity} m³ of ${recipeName} produced by ${operatorName}`,
        priority: config.defaultPriority,
        entityType: 'production',
        entityId: runId,
    });
}

export async function notifyMaterialShortage(
    recipeName: string,
    missingItem: string,
    required: number,
    available: number,
    unit: string
) {
    const config = NOTIFICATION_CONFIG.material_shortage;
    return notifyByRole(config.targetRoles!, {
        type: 'material_shortage',
        title: `Material Shortage: ${missingItem}`,
        message: `Cannot produce ${recipeName} - insufficient ${missingItem}. Required: ${required.toLocaleString()} ${unit}, Available: ${available.toLocaleString()} ${unit}`,
        priority: config.defaultPriority,
        entityType: 'inventory_item',
        entityId: undefined,
    });
}

// ==================== USER/SYSTEM TRIGGERS ====================

export async function notifyUserCreated(userId: string, userName: string, userRole: string) {
    const config = NOTIFICATION_CONFIG.user_created;
    return notifyByRole(config.targetRoles!, {
        type: 'user_created',
        title: `New User Created: ${userName}`,
        message: `A new ${userRole} account has been created for ${userName}`,
        priority: config.defaultPriority,
        entityType: 'user',
        entityId: userId,
    });
}

export async function notifyRoleChanged(
    userId: string,
    userName: string,
    oldRole: string,
    newRole: string,
    changedBy: string
) {
    const config = NOTIFICATION_CONFIG.role_changed;
    return notifyByRole(config.targetRoles!, {
        type: 'role_changed',
        title: `Role Changed: ${userName}`,
        message: `${userName}'s role changed from ${oldRole} to ${newRole} by ${changedBy}`,
        priority: config.defaultPriority,
        entityType: 'user',
        entityId: userId,
    });
}

// ==================== FLEET/MAINTENANCE TRIGGERS ====================

export async function notifyMaintenanceDue(
    truckId: string,
    truckPlate: string,
    maintenanceType: string,
    dueType: 'date' | 'mileage',
    dueInfo: string
) {
    const type = dueType === 'date' ? 'maintenance_due_date' : 'maintenance_due_mileage';
    const config = NOTIFICATION_CONFIG[type];
    return notifyByRole(config.targetRoles!, {
        type,
        title: `Maintenance Due: ${truckPlate}`,
        message: `${maintenanceType} is due for ${truckPlate}. ${dueInfo}`,
        priority: config.defaultPriority,
        entityType: 'truck',
        entityId: truckId,
    });
}

export async function notifyDocumentExpiring(
    truckId: string,
    truckPlate: string,
    documentType: string,
    expiryDate: Date
) {
    const config = NOTIFICATION_CONFIG.document_expiring;
    const daysUntil = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return notifyByRole(config.targetRoles!, {
        type: 'document_expiring',
        title: `Document Expiring: ${truckPlate}`,
        message: `${documentType} for ${truckPlate} expires in ${daysUntil} days (${expiryDate.toLocaleDateString()})`,
        priority: config.defaultPriority,
        entityType: 'truck',
        entityId: truckId,
    });
}

export async function notifySparePartsLow(partId: string, partName: string, quantity: number, minQuantity: number) {
    const config = NOTIFICATION_CONFIG.spare_parts_low;
    return notifyByRole(config.targetRoles!, {
        type: 'spare_parts_low',
        title: `Low Spare Parts: ${partName}`,
        message: `${partName} is ${quantity === 0 ? 'out of stock' : 'running low'}. Current: ${quantity}, Minimum: ${minQuantity}`,
        priority: config.defaultPriority,
        entityType: 'spare_part',
        entityId: partId,
    });
}

// ==================== SCHEDULED ALERT CHECKER ====================
// This function can be called via a cron job or manually to check all alerts

export async function runScheduledAlertChecks() {
    console.log('[Notifications] Running scheduled alert checks...');

    const results = {
        lowStock: await checkAndNotifyLowStock(),
        siloCritical: await checkAndNotifySiloCritical(),
    };

    console.log('[Notifications] Scheduled checks complete:', results);
    return results;
}
