'use server'

import prisma from '@/lib/prisma';
import { Role, ROLE_PERMISSIONS, Permission } from '@/lib/permissions';
import { auth } from '@/auth';

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

// Notification type configuration
const NOTIFICATION_CONFIG: Record<NotificationType, {
    defaultPriority: NotificationPriority;
    requiredPermissions?: Permission[]; // Who can receive this type
    targetRoles?: Role[]; // Alternative: specific roles
}> = {
    // Approval requests go to admins/managers
    new_inventory_item: { defaultPriority: 'high', requiredPermissions: ['approve_inventory_items'] },
    stock_transaction_pending: { defaultPriority: 'high', requiredPermissions: ['approve_stock_transactions'] },
    material_request_pending: { defaultPriority: 'medium', requiredPermissions: ['approve_material_requests'] },

    // Approval decisions go back to requester (handled specially)
    item_approved: { defaultPriority: 'high' },
    item_rejected: { defaultPriority: 'high' },
    transaction_approved: { defaultPriority: 'high' },
    transaction_rejected: { defaultPriority: 'high' },
    request_approved: { defaultPriority: 'high' },
    request_rejected: { defaultPriority: 'high' },

    // Inventory alerts
    low_stock_alert: { defaultPriority: 'critical', requiredPermissions: ['view_inventory'] },
    silo_level_critical: { defaultPriority: 'critical', requiredPermissions: ['view_inventory'] },

    // Fleet alerts
    maintenance_due_date: { defaultPriority: 'high', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },
    maintenance_due_mileage: { defaultPriority: 'high', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },
    document_expiring: { defaultPriority: 'medium', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },
    spare_parts_low: { defaultPriority: 'medium', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },

    // Exceptions
    new_exception: { defaultPriority: 'high', requiredPermissions: ['manage_exceptions'] },
    exception_resolved: { defaultPriority: 'low', requiredPermissions: ['view_exceptions'] },

    // Production
    production_completed: { defaultPriority: 'low', targetRoles: [Role.SUPER_ADMIN, Role.MANAGER] },
    material_shortage: { defaultPriority: 'high', requiredPermissions: ['view_inventory'] },

    // System
    user_created: { defaultPriority: 'low', targetRoles: [Role.SUPER_ADMIN] },
    role_changed: { defaultPriority: 'medium', targetRoles: [Role.SUPER_ADMIN] },
};

// ==================== CORE NOTIFICATION ACTIONS ====================

// Create a single notification for a specific user
export async function createNotification(input: CreateNotificationInput) {
    const config = NOTIFICATION_CONFIG[input.type];

    try {
        const notification = await prisma.notification.create({
            data: {
                type: input.type,
                title: input.title,
                message: input.message,
                priority: input.priority || config?.defaultPriority || 'medium',
                userId: input.userId,
                entityType: input.entityType,
                entityId: input.entityId,
            },
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
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: 'Not authenticated', notifications: [] };
    }

    try {
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
        console.error('Failed to get notifications:', error);
        return { success: false, error: 'Failed to fetch notifications', notifications: [] };
    }
}

// Get unread count for badge
export async function getUnreadCount() {
    const session = await auth();
    if (!session?.user?.id) {
        return 0;
    }

    try {
        const count = await prisma.notification.count({
            where: {
                userId: session.user.id,
                read: false,
            },
        });

        return count;
    } catch (error) {
        console.error('Failed to get unread count:', error);
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
