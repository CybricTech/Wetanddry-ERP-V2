import { fuelLogApplier } from './fuel-log';
import { maintenanceRecordApplier } from './maintenance-record';
import { maintenanceScheduleApplier } from './maintenance-schedule';
import type { EntityApplier } from './types';

// Every entityType the edit-request flow understands. Adding one is a new applier file
// plus a line here - the core, the server actions, and this file's shape are untouched.
const APPLIERS: Record<string, EntityApplier> = {
    fuel_log: fuelLogApplier,
    maintenance_record: maintenanceRecordApplier,
    maintenance_schedule: maintenanceScheduleApplier,
};

export function getApplier(entityType: string): EntityApplier | null {
    return APPLIERS[entityType] ?? null;
}

export function registeredEntityTypes(): string[] {
    return Object.keys(APPLIERS);
}
