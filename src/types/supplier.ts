export type DeliveryCorridor = {
  id: string;
  name: string;
  short_code: string;
  areas: string[];
  delivery_days: string[];
  cutoff_time: string;
  min_free_order?: number;
  surcharge_outside?: number;
};

export type VerifiedSupplier = {
  id: string;
  company_name: string;
  brand_authorizations: string[];
  business_categories: string[];
  depot_address: string;
  county: string;
  town: string;
  phone: string;
  email: string;
  corridors: DeliveryCorridor[];
  moq_amount: number;
  rating: number;
  rating_count: number;
  active_trade_deal?: string;
  is_verified: boolean;
  verified_since?: string;
  open_catalogue?: boolean;
  rfq_enabled?: boolean;
};

export type SupplierConnection = {
  id: string;
  store_id: string;
  branch_name: string;
  supplier_id: string;
  supplier_name: string;
  synced_landmark: string;
  corridor_matched: string;
  delivery_days: string[];
  cutoff_time: string;
  is_inside_corridor: boolean;
  synced_at: string;
};
