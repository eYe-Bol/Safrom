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
    const plan = parts[1]; // e.g. "PRO" or "BASIC"
    const months = parseInt(parts[2], 10);

    // Initialize Supabase with service role key to bypass RLS for webhook updates
    // If you don't have SUPABASE_SERVICE_ROLE_KEY, the update might fail due to RLS policies.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch current user to get their existing subscription_end_date
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('subscription_end_date')
      .eq('id', storeId)
      .single();

    if (fetchErr || !user) {
      console.error('User not found:', fetchErr);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Calculate new end date
    let currentEndDate = new Date();
    if (user.subscription_end_date && new Date(user.subscription_end_date) > currentEndDate) {
      currentEndDate = new Date(user.subscription_end_date);
    }
    
    // Add the purchased months
    currentEndDate.setMonth(currentEndDate.getMonth() + months);

    // 3. Update the user record
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        subscription_plan: plan.toLowerCase(), // 'basic' or 'pro'
        subscription_end_date: currentEndDate.toISOString()
      })
      .eq('id', storeId);

    if (updateErr) {
      console.error('Failed to update user:', updateErr);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
