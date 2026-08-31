import { fuelLogApplier } from './fuel-log';
import type { EntityApplier } from './types';

// Only fuel_log is registered. The maintenance appliers designed in
// 2026-08-31-maintenance-edit-approvals-design.md register here later with no change
// to the core, the actions, or this file's shape.
const APPLIERS: Record<string, EntityApplier> = {
    fuel_log: fuelLogApplier,
};

export function getApplier(entityType: string): EntityApplier | null {
    return APPLIERS[entityType] ?? null;
}

export function registeredEntityTypes(): string[] {
    return Object.keys(APPLIERS);
}
