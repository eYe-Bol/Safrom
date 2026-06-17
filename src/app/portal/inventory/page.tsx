import { redirect } from 'next/navigation';

// Inventory content has moved into the "Inventory & Order Tracker" (Stock Manager tab)
export default function InventoryRedirect() {
  redirect('/portal/situation');
}
