// Shared between the Add Item and Edit Item forms in InventoryClient.tsx.
//
// One list on purpose: the two forms previously carried their own hardcoded options
// and had drifted apart, so an item created with a unit the edit form did not offer
// (drums, gallons) opened on the first option and was silently converted on save.
// InventoryItem.unit stores this value, so renaming one orphans existing rows.
export const INVENTORY_UNITS = [
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 'liters', label: 'Liters' },
    { value: 'pcs', label: 'Pieces' },
    { value: 'm³', label: 'Cubic Meters (m³)' },
    { value: 'tons', label: 'Tons' },
    { value: 'drums', label: 'Drums' },
    { value: 'gallons', label: 'Gallons' },
    { value: 'roll', label: 'Roll' },
] as const

export type InventoryUnit = (typeof INVENTORY_UNITS)[number]['value']
