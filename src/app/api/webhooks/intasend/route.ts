import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if payment was successful
    // Intasend sends 'COMPLETE' when successful
    if (body.state !== 'COMPLETE') {
      return NextResponse.json({ received: true, status: 'ignored' });
    }

    const apiRef = body.api_ref; // e.g. "storeId_PRO_4_16200000"
    if (!apiRef) {
      return NextResponse.json({ error: 'Missing api_ref' }, { status: 400 });
    }

    const parts = apiRef.split('_');
    if (parts.length < 3) {
      return NextResponse.json({ error: 'Invalid api_ref format' }, { status: 400 });
    }

    const storeId = parts[0];
    const plan = parts[1]; // e.g. "PRO", "BASIC", "MULTI_BRANCH", "MULTI_STORE"
    const months = parseInt(parts[2], 10) || 12;
    const outlets = parts.length >= 5 ? parseInt(parts[3], 10) : (plan.toUpperCase() === 'PRO' ? 3 : 1);
    const actionType = parts.length >= 5 ? parts[4].toUpperCase() : 'RENEW';

    // Initialize Supabase with service role key to bypass RLS for webhook updates
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch current user to get their existing subscription_end_date and branch_limit
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('subscription_end_date, subscription_plan, branch_limit, scale')
      .eq('id', storeId)
      .single();

    if (fetchErr || !user) {
      console.error('User not found:', fetchErr);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Handle Subscription Dates & Master Expiry Co-terming
    let newEndDate: string;
    
    if (actionType === 'ADDON' && user.subscription_end_date && new Date(user.subscription_end_date) > new Date()) {
      // Co-terming: Mid-year outlet add-on maintains the existing master anniversary date
      newEndDate = user.subscription_end_date;
    } else {
      // Full annual renewal or new purchase: extend by months (default 12)
      let currentEndDate = new Date();
      if (user.subscription_end_date && new Date(user.subscription_end_date) > currentEndDate) {
        currentEndDate = new Date(user.subscription_end_date);
      }
      currentEndDate.setMonth(currentEndDate.getMonth() + months);
      newEndDate = currentEndDate.toISOString();
    }

    // 3. Determine plan key and scale
    const normalizedPlan = plan.toLowerCase();
    const isMultiPlan = normalizedPlan.includes('branch') || normalizedPlan.includes('store') || normalizedPlan === 'pro' || normalizedPlan === 'growth' || outlets > 1;
    const finalScale = isMultiPlan ? 'multi' : 'single';
    const finalBranchLimit = Math.max(outlets, user.branch_limit || (isMultiPlan ? 3 : 1));

    // 4. Update user record
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        subscription_plan: normalizedPlan,
        subscription_end_date: newEndDate,
        branch_limit: finalBranchLimit,
        scale: finalScale,
      })
      .eq('id', storeId);

    if (updateErr) {
      console.error('Failed to update user:', updateErr);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: true, branch_limit: finalBranchLimit });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
