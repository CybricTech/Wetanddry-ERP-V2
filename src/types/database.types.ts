export type UserRole = 'admin' | 'storekeeper' | 'operations_manager' | 'accountant' | 'driver';
export type TruckStatus = 'available' | 'in_use' | 'maintenance';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type InventoryCategory = 'asset' | 'consumable' | 'equipment';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Truck {
  id: string;
  plate_number: string;
  model: string;
  capacity: string;
  status: TruckStatus;
  purchase_date: string;
  current_mileage: number;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRecord {
  id: string;
  truck_id: string;
  maintenance_type: string;
  scheduled_date?: string;
  completed_date?: string;
  cost?: number;
  status: string;
  notes?: string;
  performed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Part {
  id: string;
  part_number: string;
  name: string;
  category: string;
  quantity: number;
  unit_price?: number;
  created_at: string;
  updated_at: string;
}

export interface TruckPart {
  id: string;
  truck_id: string;
  part_id: string;
  installed_date: string;
  expected_lifespan_months?: number;
  status: string;
  replaced_date?: string;
  installed_by?: string;
  created_at: string;
}