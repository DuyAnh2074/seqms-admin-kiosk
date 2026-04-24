export interface TicketTemplate {
  id: string;
  code: string;
  format: string;
  min: number;
  max: number;
  createdDate: string;
}

export interface Service {
  id: string | number;
  code?: string;
  name?: string;
  nameEn?: string;
  nameVn?: string;
  icon_url?: string;
  ticketFormat?: string;
  createdDate?: string;
  is_active?: boolean;
}

export interface ServiceGroup {
  id: string | number;
  code?: string;
  name: string;
  services?: string[];
  createdDate?: string;
  icon_url?: string;
  is_active?: boolean;
}

export interface Province {
  id: string | number;
  name: string;
  code?: string;
  createdDate?: string;
}

export interface District {
  id: string | number;
  provinceId?: string | number;
  province_id?: number;
  name: string;
  code?: string;
  createdDate?: string;
}

export interface TransactionOffice {
  id: string | number;
  name: string;
  code?: string;
  address?: string;
  districtId?: string;
  district_id?: number;
  createdDate?: string;
  status?: 'Active' | 'Inactive' | 'active' | 'inactive';
}

export interface Kiosk {
  id: string | number;
  name: string;
  code: string;
  location?: string;
  locationId?: number;
  serviceGroupIds?: number[]; // Multiple service groups
  serviceIds?: number[]; // Multiple services
  serviceDisplay?: string; // Combined display string for groups and services
  ip_address?: string;
  createdDate?: string;
  status?: 'Online' | 'Offline' | 'active' | 'inactive';
  is_active?: boolean;
}

export interface Counter {
  id: string;
  name: string;
  code: string;
  location: string;
  priorityServices: string[];
  createdDate: string;
}

export interface ElectronicBoard {
  id: string;
  name: string;
  code: string;
  location: string;
  type: 'Video' | 'Image';
  createdDate: string;
}

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: 'Admin' | 'Staff' | 'Manager';
  branch: string;
  status: 'Active' | 'Inactive';
  createdDate: string;
}

export interface TransactionRecord {
  id: string;
  office: string;
  counter: string;
  employee: string;
  service: string;
  ticketNumber: string;
  ticketType: 'Online' | 'Kiosk' | 'QrScan';
  calledAt: string;
  waitingTime: string;
  status: 'Completed' | 'Cancelled' | 'Waiting';
}

// Kiosk Client API Response Types
export interface KioskInfo {
  id: number;
  code: string;
  name: string;
  office_name: string;
}

export interface KioskServiceItem {
  id: number;
  name: string;
  icon_url: string | null;
}

export interface KioskClientResponse {
  kiosk_info: KioskInfo;
  services: KioskServiceItem[];
}
