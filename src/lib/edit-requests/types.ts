import type { Permission } from '@/lib/permissions';
import type { NotificationType } from '@/lib/actions/notifications';

export type FieldValues = Record<string, unknown>;

export type EditRequestResult = { success: true } | { error: string };

export type EditOperation = 'update' | 'delete';

/**
 * An EditRequest as it crosses to a client component, after the page's
 * JSON.parse(JSON.stringify(...)) pass. Lives here rather than beside a component so
 * FuelClient and FuelEditRequestsSection can both use it without importing each other.
 */
export interface EditRequestView {
    id: string;
    entityId: string;
    operation: string;
    proposedChanges: FieldValues | null;
    previousValues: FieldValues | null;
    status: string;
    requestedBy: string;
    rejectionReason: string | null;
    createdAt: string;
}

/**
 * Domain semantics for one entityType. The generic core never merges proposed JSON
 * into a Prisma update on its own — it always goes through an applier, whose
 * editableFields whitelist is the only thing standing between a crafted payload and
 * mass assignment.
 */
export interface EntityApplier {
    /** Permission required to submit a request. */
    requestPermission: Permission;
    /** Permission required to approve or reject one, and to bypass the queue entirely. */
    approvePermission: Permission;
    /** The ONLY fields that may be written through this path. */
    editableFields: readonly string[];
    /** Current values, or null if the row is gone. Returns at least every editable field. */
    load(id: string): Promise<FieldValues | null>;
    /** Domain validation at approval time. Returns an error message, or null if fine. */
    validate?(changes: FieldValues, current: FieldValues): Promise<string | null>;
    applyUpdate(id: string, changes: FieldValues): Promise<void>;
    applyDelete(id: string): Promise<void>;
    /** Human-readable label for notification text. */
    describe(entity: FieldValues): string;
    /**
     * What this kind of record is called, for notification titles: "Fuel log" gives
     * "Fuel log edit requested". Without it the generic core cannot name the thing it
     * is notifying about, and every module's notifications read as the first one built.
     */
    noun: string;
    /** Notification types fired when a request is raised and when it is decided. */
    notifications: {
        pending: NotificationType;
        approved: NotificationType;
        rejected: NotificationType;
    };
    /** Routes to revalidate after a request is created or decided. */
    revalidatePaths(entity: FieldValues): string[];
    /** Recompute hook, given the entity as it stood BEFORE the change. */
    onApplied?(before: FieldValues, operation: EditOperation, changes: FieldValues): Promise<void>;
}
