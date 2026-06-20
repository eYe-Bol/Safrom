import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { owner_id, email, password, full_name, branch_name, staff_role } = await req.json();

    if (!owner_id || !email || !password || !full_name || !branch_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Check Owner Subscription & Quotas
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('subscription_plan, created_at, store_name')
      .eq('id', owner_id)
      .single();

    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 });
    }

    const trialEnd = new Date(owner.created_at);
    trialEnd.setDate(trialEnd.getDate() + 7);
    const isTrial = trialEnd > new Date();
    const plan = owner.subscription_plan;

    // Quota limits
    let maxTotal = 0;
    let maxMain = 0;
    let maxBranch2 = 0;
    let maxBranch3 = 0;

    if (plan === '1499' || isTrial) {
      maxTotal = 4;
      maxMain = 2;
      maxBranch2 = 1;
      maxBranch3 = 1;
    } else if (plan === '999') {
      maxTotal = 1;
      maxMain = 1;
    } else {
      return NextResponse.json({ error: 'Subscription required to add staff' }, { status: 403 });
    }

    // Check current usage
    const { data: currentStaff } = await supabaseAdmin
      .from('users')
      .select('branch_name')
      .eq('owner_id', owner_id)
      .eq('role', 'employee');

    const staffCount = currentStaff?.length || 0;
    if (staffCount >= maxTotal) {
      return NextResponse.json({ error: 'Maximum total staff limit reached for your plan.' }, { status: 403 });
    }

    const mainCount = currentStaff?.filter(s => s.branch_name === 'Main Branch').length || 0;
    const b2Count = currentStaff?.filter(s => s.branch_name === 'Branch 2').length || 0;
    const b3Count = currentStaff?.filter(s => s.branch_name === 'Branch 3').length || 0;

    if (branch_name === 'Main Branch' && mainCount >= maxMain) return NextResponse.json({ error: 'Main Branch is full' }, { status: 403 });
    if (branch_name === 'Branch 2' && b2Count >= maxBranch2) return NextResponse.json({ error: 'Branch 2 is full' }, { status: 403 });
    if (branch_name === 'Branch 3' && b3Count >= maxBranch3) return NextResponse.json({ error: 'Branch 3 is full' }, { status: 403 });

    // 2. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 3. Wait briefly for any DB trigger to fire, then forcefully set the role via raw update
    // Use a raw SQL upsert that bypasses the check constraint race condition
    await new Promise(resolve => setTimeout(resolve, 500));

    // First try to delete and re-insert to avoid constraint conflicts from triggers
    // Step A: Delete any auto-created row from the trigger
    await supabaseAdmin.from('users').delete().eq('id', userId);

    // Step B: Insert fresh with correct role = 'employee'
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: email,
        full_name: full_name,
        role: 'employee',
        owner_id: owner_id,
        branch_name: branch_name,
        staff_role: staff_role || 'Sales Staff',
        subscription_status: 'active',
        is_active: true,
      });

    if (dbError) {
      // Fallback: try upsert if insert failed (row might exist)
      const { error: upsertError } = await supabaseAdmin
        .from('users')
        .update({
          role: 'employee',
          owner_id: owner_id,
          branch_name: branch_name,
          full_name: full_name,
          staff_role: staff_role || 'Sales Staff',
          subscription_status: 'active',
          is_active: true,
        })
        .eq('id', userId);

      if (upsertError) {
        console.error('Staff linking failed:', upsertError);
        return NextResponse.json({ error: `Failed to link staff account: ${upsertError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    console.error('Staff API error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { staff_id, owner_id } = await req.json();

    if (!staff_id || !owner_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Verify ownership
    const { data: staffMember } = await supabaseAdmin
      .from('users')
      .select('owner_id')
      .eq('id', staff_id)
      .single();

    if (!staffMember || staffMember.owner_id !== owner_id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Delete auth user (cascades to public.users if set up)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(staff_id);
    if (authDeleteError) {
      console.error('Auth delete error:', authDeleteError);
    }

    // Also ensure the public.users row is deleted
    await supabaseAdmin.from('users').delete().eq('id', staff_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
