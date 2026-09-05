'use client';

export type WholesaleProduct = {
  id: string;
  supplier_id: string;
  name: string;
  brand: string;
  category: string;
  pack_size: string;
  wholesale_price: number;
  rrp: number;
  moq_packs: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order';
  batch_lot_prefix: string;
  active_deal?: string;
  description?: string;
};

export const DEFAULT_MOCK_CATALOGUES: Record<string, WholesaleProduct[]> = {
  sup_eabl_thika_rd: [
    {
      id: 'prod_eabl_tusker_crate',
      supplier_id: 'sup_eabl_thika_rd',
      name: 'Tusker Lager 500ml',
      brand: 'EABL',
      category: 'Alcohol / Beer',
      pack_size: 'Crate (25 bottles)',
      wholesale_price: 4100,
      rrp: 200,
      moq_packs: 5,
      stock_status: 'in_stock',
      batch_lot_prefix: 'EABL-TUS-2026',
      active_deal: 'Buy 25 Crates → 1 Crate Free Balozi',
      description: 'Direct brewery dispatch. Returnable glass bottles (empties exchange required).'
    },
    {
      id: 'prod_eabl_whitecap_crate',
      supplier_id: 'sup_eabl_thika_rd',
      name: 'White Cap Crisp 330ml',
      brand: 'EABL',
      category: 'Alcohol / Beer',
      pack_size: 'Crate (24 bottles)',
      wholesale_price: 3950,
      rrp: 200,
      moq_packs: 3,
      stock_status: 'in_stock',
      batch_lot_prefix: 'EABL-WCP-2026',
      description: 'Premium cold-filtered lager.'
    },
    {
      id: 'prod_eabl_guinness_crate',
      supplier_id: 'sup_eabl_thika_rd',
      name: 'Guinness Foreign Extra Stout 500ml',
      brand: 'EABL',
      category: 'Alcohol / Beer',
      pack_size: 'Crate (25 bottles)',
      wholesale_price: 4650,
      rrp: 230,
      moq_packs: 5,
      stock_status: 'in_stock',
      batch_lot_prefix: 'EABL-GNS-2026'
    },
    {
      id: 'prod_eabl_chrome_vodka',
      supplier_id: 'sup_eabl_thika_rd',
      name: 'Chrome Vodka 250ml',
      brand: 'UDV',
      category: 'Spirits',
      pack_size: 'Carton (24 bottles)',
      wholesale_price: 3750,
      rrp: 180,
      moq_packs: 2,
      stock_status: 'in_stock',
      batch_lot_prefix: 'UDV-CHR-2026'
    }
  ],
  sup_brookside_kapa_fmcg: [
    {
      id: 'prod_rina_oil_carton',
      supplier_id: 'sup_brookside_kapa_fmcg',
      name: 'Rina Vegetable Cooking Oil 1L',
      brand: 'Kapa Oil',
      category: 'Edible Oils',
      pack_size: 'Carton (12 x 1L)',
      wholesale_price: 3450,
      rrp: 320,
      moq_packs: 3,
      stock_status: 'in_stock',
      batch_lot_prefix: 'KAPA-RIN-2026',
      active_deal: 'Order 15+ Cartons → 4.5% Instant Rebate',
      description: 'Triple refined pure vegetable cooking oil with Vitamin A & D.'
    },
    {
      id: 'prod_brookside_fresh_milk',
      supplier_id: 'sup_brookside_kapa_fmcg',
      name: 'Brookside Fresh Milk 500ml Pouch',
      brand: 'Brookside',
      category: 'Dairy',
      pack_size: 'Crate (18 pouches)',
      wholesale_price: 1100,
      rrp: 70,
      moq_packs: 5,
      stock_status: 'in_stock',
      batch_lot_prefix: 'BRK-MLK-2026',
      description: 'Pasteurized whole milk. Daily morning dispatch.'
    },
    {
      id: 'prod_elianto_corn_oil',
      supplier_id: 'sup_brookside_kapa_fmcg',
      name: 'Elianto Pure Corn Oil 2L',
      brand: 'Kapa Oil',
      category: 'Edible Oils',
      pack_size: 'Carton (6 x 2L)',
      wholesale_price: 3800,
      rrp: 690,
      moq_packs: 2,
      stock_status: 'in_stock',
      batch_lot_prefix: 'KAPA-ELI-2026'
    },
    {
      id: 'prod_jogoo_flour_bale',
      supplier_id: 'sup_brookside_kapa_fmcg',
      name: 'Jogoo Maize Meal 2kg',
      brand: 'Unga Group',
      category: 'Grains & Flour',
      pack_size: 'Bale (12 x 2kg)',
      wholesale_price: 1850,
      rrp: 175,
      moq_packs: 5,
      stock_status: 'in_stock',
      batch_lot_prefix: 'UNG-JOG-2026'
    }
  ],
  sup_medlink_pharma: [
    {
      id: 'prod_panadol_extra_box',
      supplier_id: 'sup_medlink_pharma',
      name: 'Panadol Extra 500mg/65mg (Red)',
      brand: 'GSK',
      category: 'Pharmaceuticals',
      pack_size: 'Pack (100 blister cards x 2 tabs)',
      wholesale_price: 3600,
      rrp: 50,
      moq_packs: 2,
      stock_status: 'in_stock',
      batch_lot_prefix: 'GSK-PAN-2026',
      description: 'PPB certified genuine batch with tamper-evident seal.'
    },
    {
      id: 'prod_amoxil_caps_bottle',
      supplier_id: 'sup_medlink_pharma',
      name: 'Amoxicillin 500mg Capsules',
      brand: 'GlaxoSmithKline',
      category: 'Pharmaceuticals',
      pack_size: 'Bottle (500 capsules)',
      wholesale_price: 2400,
      rrp: 10,
      moq_packs: 2,
      stock_status: 'in_stock',
      batch_lot_prefix: 'GSK-AMX-2026'
    }
  ]
};
