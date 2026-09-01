export type BusinessTypeOption = {
  id: string;
  label: string;
};

export const BUSINESS_TYPES: BusinessTypeOption[] = [
  { id: 'pub', label: '🍺 Pub' },
  { id: 'bar', label: '🍸 Bar' },
  { id: 'lounge', label: '🛋️ Lounge' },
  { id: 'chemist', label: '💊 Chemist' },
  { id: 'pharmacy', label: '⚕️ Pharmacy' },
  { id: 'cosmetics', label: '💄 Cosmetics' },
  { id: 'beauty_shop', label: '💅 Beauty Shop' },
  { id: 'retail_store', label: '🏪 Retail Store' },
  { id: 'supermarket', label: '🛒 Supermarket' },
  { id: 'minimart', label: '🏬 Minimart' },
  { id: 'restaurant', label: '🍽️ Restaurant' },
  { id: 'fast_food', label: '🍔 Fast Food' },
  { id: 'eatery', label: '🍲 Eatery / Cafe' },
  { id: 'salon', label: '✂️ Salon' },
  { id: 'barbershop', label: '💈 Barbershop' },
  { id: 'hardware', label: '🔨 Hardware' },
  { id: 'agrovet', label: '🌾 Agrovet' },
  { id: 'wines_and_spirits', label: '🍾 Wines & Spirits' },
  { id: 'liquor_store', label: '🥃 Liquor Store' },
  { id: 'boutique', label: '👗 Boutique / Clothing' },
  { id: 'butchery', label: '🥩 Butchery' },
  { id: 'bakery', label: '🍞 Bakery' },
  { id: 'electronics', label: '📱 Electronics Shop' },
  { id: 'general_store', label: '📦 General Store' },
  { id: 'other', label: '🏷️ Other' },
];

export function getBusinessTypeLabel(id: string | null | undefined): string {
  if (!id) return '🏪 Retail Store';
  const aliasMap: Record<string, string> = {
    retail: 'retail_store',
    liquor: 'wines_and_spirits',
    beauty: 'beauty_shop',
    general: 'general_store',
    fastfood: 'fast_food',
    wines_spirits: 'wines_and_spirits',
  };
  const targetId = aliasMap[id] || id;
  const found = BUSINESS_TYPES.find(b => b.id === targetId || b.id === id);
  return found?.label || id;
}