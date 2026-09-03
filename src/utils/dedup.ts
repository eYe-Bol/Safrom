import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Automatically detects and cleans up duplicate inventory products for a given store & branch.
 * Merges stock counts and re-links historical sales to the primary product before deleting duplicates.
 */
export async function autoDeduplicateInventory(
  supabase: SupabaseClient,
  storeId: string,
  branchName: string
): Promise<number> {
  if (!storeId) return 0;
  const curBranch = branchName || 'Main Branch';

  try {
    // 1. Fetch all inventory products for this store and branch
    const { data: items, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', storeId)
      .eq('branch_name', curBranch)
      .order('created_at', { ascending: true });

    if (error || !items || items.length === 0) return 0;

    // 2. Group by normalized name
    const groups: Record<string, typeof items> = {};
    for (const item of items) {
      const key = (item.name || '').trim().toLowerCase();
      if (!key) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    let totalCleaned = 0;

    // 3. Process each group that has > 1 record
    for (const key of Object.keys(groups)) {
      const dupes = groups[key];
      if (dupes.length <= 1) continue;

      // Primary is the oldest or the one with active pricing/stock
      const primary = dupes[0];
      const secondaries = dupes.slice(1);

      let mergedStock = Number(primary.stock) || 0;

      for (const secondary of secondaries) {
        // Add duplicate's stock to primary
        mergedStock += Number(secondary.stock) || 0;

        // Re-link any sales made under the duplicate ID to the primary ID
        await supabase
          .from('sales')
          .update({ inventory_id: primary.id })
          .eq('inventory_id', secondary.id);

        // Delete the duplicate inventory entry
        await supabase
          .from('inventory')
          .delete()
          .eq('id', secondary.id);

        totalCleaned++;
      }

      // Update primary item with combined stock
      if (mergedStock !== primary.stock) {
        await supabase
          .from('inventory')
          .update({ stock: mergedStock })
          .eq('id', primary.id);
      }
    }

    return totalCleaned;
  } catch (err) {
    console.error('Inventory auto-deduplication error:', err);
    return 0;
  }
}

/**
 * Automatically detects and cleans up duplicate suppliers for a given store & branch.
 */
export async function autoDeduplicateSuppliers(
  supabase: SupabaseClient,
  storeId: string,
  branchName: string
): Promise<number> {
  if (!storeId) return 0;
  const curBranch = branchName || 'Main Branch';

  try {
    const { data: sups, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', storeId)
      .eq('branch_name', curBranch)
      .order('created_at', { ascending: true });

    if (error || !sups || sups.length === 0) return 0;

    const groups: Record<string, typeof sups> = {};
    for (const sup of sups) {
      const key = (sup.name || '').trim().toLowerCase();
      if (!key) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sup);
    }

    let totalCleaned = 0;

    for (const key of Object.keys(groups)) {
      const dupes = groups[key];
      if (dupes.length <= 1) continue;

      const secondaries = dupes.slice(1);
      for (const secondary of secondaries) {
        await supabase
          .from('suppliers')
          .delete()
          .eq('id', secondary.id);
        totalCleaned++;
      }
    }

    return totalCleaned;
  } catch (err) {
    console.error('Suppliers auto-deduplication error:', err);
    return 0;
  }
}