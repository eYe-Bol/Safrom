import { VerifiedSupplier } from '@/types/supplier';

export const MOCK_VERIFIED_SUPPLIERS: VerifiedSupplier[] = [
  {
    id: 'sup_eabl_thika_rd',
    company_name: 'Metro Beverage Distributors Ltd',
    brand_authorizations: ['EABL', 'KBL', 'UDV', 'Keroche'],
    business_categories: ['bar_restaurant', 'wines_spirits', 'retail_store', 'supermarket_minimart'],
    depot_address: 'Thika Superhighway Depot, Ruiru Bypass Junction',
    county: 'Kiambu / Nairobi',
    town: 'Ruiru / Nairobi North',
    phone: '+254 711 200 300',
    email: 'orders@metrobeverages.co.ke',
    moq_amount: 12000,
    rating: 4.9,
    rating_count: 1420,
    active_trade_deal: 'Buy 25 Crates Balozi or WhiteCap → Get 1 Crate Free (This Week Only)',
    is_verified: true,
    verified_since: '2024',
    open_catalogue: true,
    rfq_enabled: true,
    corridors: [
      {
        id: 'c_nbi_north',
        name: 'Nairobi North Corridor (Thika Rd / Roysambu / Kasarani / Ruiru / Juja)',
        short_code: 'nairobi_north',
        areas: ['kasarani', 'roysambu', 'ruiru', 'githurai', 'kahawa', 'juja', 'thika', 'ngara', 'muthaiga', 'ruaka', 'zimman'],
        delivery_days: ['Tuesday', 'Friday'],
        cutoff_time: '17:00',
        min_free_order: 15000,
        surcharge_outside: 600,
      },
      {
        id: 'c_nbi_east',
        name: 'Nairobi East Corridor (Jogoo Rd / Eastleigh / Umoja / Donholm / Buruburu)',
        short_code: 'nairobi_east',
        areas: ['eastleigh', 'buruburu', 'umoja', 'donholm', 'komarock', 'kayole', 'pipeline', 'embakasi', 'jogoo rd'],
        delivery_days: ['Monday', 'Thursday'],
        cutoff_time: '16:30',
        min_free_order: 20000,
        surcharge_outside: 800,
      },
    ],
  },
  {
    id: 'sup_brookside_kapa_fmcg',
    company_name: 'Apex FMCG Master Wholesalers',
    brand_authorizations: ['Brookside', 'Kapa Oil Refineries', 'Bidco Africa', 'Unga Group', 'Kenyas Choice'],
    business_categories: ['retail_store', 'supermarket_minimart', 'grocery_fresh', 'bar_restaurant'],
    depot_address: 'Enterprise Road, Industrial Area, Nairobi',
    county: 'Nairobi',
    town: 'Industrial Area / Citywide',
    phone: '+254 722 550 880',
    email: 'wholesale@apexfmcg.co.ke',
    moq_amount: 15000,
    rating: 4.8,
    rating_count: 2180,
    active_trade_deal: 'Order 30+ Cartons Rina / Elianto Cooking Oil → 4.5% Instant Margin Rebate',
    is_verified: true,
    verified_since: '2023',
    open_catalogue: true,
    rfq_enabled: true,
    corridors: [
      {
        id: 'c_nbi_south_central',
        name: 'Nairobi South & CBD (Industrial Area / South B/C / Langata / CBD)',
        short_code: 'nairobi_south',
        areas: ['industrial area', 'south b', 'south c', 'cbd', 'nairobi cbd', 'langata', 'nairobi west', 'imara daima', 'syokimau'],
        delivery_days: ['Monday', 'Wednesday', 'Friday'],
        cutoff_time: '18:00',
        min_free_order: 15000,
        surcharge_outside: 500,
      },
      {
        id: 'c_nbi_west',
        name: 'Nairobi West Corridor (Westlands / Parklands / Kangemi / Kilimani / Lavington)',
        short_code: 'nairobi_west',
        areas: ['westlands', 'parklands', 'kilimani', 'lavington', 'kileleshwa', 'hurlingham', 'kangemi', 'uthiru', 'waiyaki way'],
        delivery_days: ['Tuesday', 'Thursday', 'Saturday'],
        cutoff_time: '17:00',
        min_free_order: 18000,
        surcharge_outside: 650,
      },
    ],
  },
  {
    id: 'sup_pharma_care_kenya',
    company_name: 'MedLink Pharmaceuticals & Surgical Supplies',
    brand_authorizations: ['GlaxoSmithKline', 'Dawa Life Sciences', 'Cosmos Ltd', 'Bayer', 'Regal Pharmaceuticals'],
    business_categories: ['chemist_pharmacy', 'cosmetics_beauty', 'retail_store'],
    depot_address: 'Commercial Street, Off Mombasa Road, Nairobi',
    county: 'Nairobi',
    town: 'Nairobi / National Courier',
    phone: '+254 733 440 990',
    email: 'supply@medlinkpharma.co.ke',
    moq_amount: 8000,
    rating: 4.95,
    rating_count: 960,
    active_trade_deal: 'Full PPB-Certified Generic Antibiotics & Pain Relief Batch Pack (10% Off)',
    is_verified: true,
    verified_since: '2023',
    open_catalogue: false,
    rfq_enabled: true,
    corridors: [
      {
        id: 'c_nbi_all_corridors',
        name: 'Nairobi Metropolitan Chemist Route (All Sub-Counties)',
        short_code: 'nbi_metro',
        areas: ['cbd', 'westlands', 'kasarani', 'eastleigh', 'kilimani', 'langata', 'south c', 'buruburu', 'roysambu', 'thika', 'ruiru', 'nakuru'],
        delivery_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        cutoff_time: '14:00',
        min_free_order: 10000,
        surcharge_outside: 400,
      },
    ],
  },
  {
    id: 'sup_nakuru_beverage_millers',
    company_name: 'Rift Valley Wholesalers & Millers Depot',
    brand_authorizations: ['EABL', 'Unga Limited', 'Menengai Oil Refineries', 'Brookside'],
    business_categories: ['bar_restaurant', 'wines_spirits', 'supermarket_minimart', 'retail_store'],
    depot_address: 'George Morara Avenue, Industrial Area, Nakuru',
    county: 'Nakuru',
    town: 'Nakuru Town / Sub-Counties',
    phone: '+254 700 889 900',
    email: 'orders@rvwholesalers.co.ke',
    moq_amount: 10000,
    rating: 4.85,
    rating_count: 810,
    active_trade_deal: 'Buy 50 Bales Unga (Jogoo/Hostess) → Free Delivery within Nakuru County',
    is_verified: true,
    verified_since: '2024',
    open_catalogue: true,
    rfq_enabled: true,
    corridors: [
      {
        id: 'c_nakuru_central',
        name: 'Nakuru Town & Highway Corridor (CBD / Section 58 / Free Area / Lanet / Njoro)',
        short_code: 'nakuru_central',
        areas: ['nakuru', 'section 58', 'free area', 'lanet', 'kiamunyi', 'milimani', 'njoro', 'cbd nakuru', 'pipeline nakuru'],
        delivery_days: ['Monday', 'Wednesday', 'Friday'],
        cutoff_time: '16:00',
        min_free_order: 10000,
        surcharge_outside: 500,
      },
    ],
  },
  {
    id: 'sup_crown_hardware_cement',
    company_name: 'Bamburi & Crown Direct Building Materials',
    brand_authorizations: ['Bamburi Cement', 'Crown Paints', 'Mabati Rolling Mills', 'Apex Steel'],
    business_categories: ['hardware_store', 'retail_store'],
    depot_address: 'Kitui Road, Off Dunga Road, Industrial Area, Nairobi',
    county: 'Nairobi',
    town: 'Nairobi / Kiambu / Machakos',
    phone: '+254 720 112 233',
    email: 'orders@crowndirect.co.ke',
    moq_amount: 35000,
    rating: 4.75,
    rating_count: 540,
    active_trade_deal: 'Bamburi PowerPlus 42.5N Cement Truckload: Tier-1 Factory Direct Rates',
    is_verified: true,
    verified_since: '2023',
    open_catalogue: false,
    rfq_enabled: true,
    corridors: [
      {
        id: 'c_nbi_hardware_route',
        name: 'Nairobi Metropolitan & Satellite Construction Belt',
        short_code: 'nbi_metro_hardware',
        areas: ['ruiru', 'kitengela', 'athl river', 'kasarani', 'westlands', 'kikuyu', 'syokimau', 'ngong', 'ruaka', 'thika', 'machakos'],
        delivery_days: ['Tuesday', 'Thursday', 'Saturday'],
        cutoff_time: '15:00',
        min_free_order: 50000,
        surcharge_outside: 1500,
      },
    ],
  },
];

/**
 * Check if store's landmark or town matches a supplier's delivery corridors.
 */
export function evaluateSupplierCorridorMatch(supplier: VerifiedSupplier, landmarkOrTown: string): {
  isMatched: boolean;
  matchedCorridor?: string;
  deliveryDays: string[];
  cutoffTime: string;
} {
  const cleanInput = (landmarkOrTown || '').toLowerCase().trim();
  if (!cleanInput) {
    // Default to first corridor if input empty
    const first = supplier.corridors[0];
    return {
      isMatched: true,
      matchedCorridor: first?.name || 'Standard Route',
      deliveryDays: first?.delivery_days || ['Tuesday', 'Friday'],
      cutoffTime: first?.cutoff_time || '17:00',
    };
  }

  for (const c of supplier.corridors) {
    const areaHit = c.areas.some(a => cleanInput.includes(a) || a.includes(cleanInput));
    const nameHit = c.name.toLowerCase().includes(cleanInput);
    if (areaHit || nameHit) {
      return {
        isMatched: true,
        matchedCorridor: c.name,
        deliveryDays: c.delivery_days,
        cutoffTime: c.cutoff_time,
      };
    }
  }

  // Not matched to any corridor
  return {
    isMatched: false,
    matchedCorridor: undefined,
    deliveryDays: [],
    cutoffTime: '17:00',
  };
}
