import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    const { owner_id, email, password, full_name, branch_name, staff_role } = await req.json();

    if (!owner_id || !email || !password || !full_name || !branch_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Security check: Caller must be authenticated and match owner_id
    if (!authUser || authUser.id !== owner_id) {
      return NextResponse.json({ error: 'Unauthorized: Active owner session required' }, { status: 401 });
    }

    // 1. Check Owner Subscription & Quotas
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('subscription_plan, created_at, store_name, branch_limit, scale')
      .eq('id', owner_id)
      .single();

    if (!owner) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 });
    }

    const trialEnd = new Date(owner.created_at);
    trialEnd.setDate(trialEnd.getDate() + 7);
    const isTrial = trialEnd > new Date();
    const plan = (owner.subscription_plan || '').toLowerCase();

    const isMultiPlan = plan.includes('branch') || plan.includes('store') || plan === '1999' || plan === '1499' || plan === 'pro' || plan === 'growth' || isTrial;
    const branchLimit = owner.branch_limit || (isMultiPlan ? 3 : 1);

    // Quota limits: up to 2 staff per branch for multi-outlet, 1 staff for starter
    let maxTotal = 1;
    let maxPerBranch = 1;

    if (isMultiPlan) {
      maxTotal = branchLimit * 2;
      maxPerBranch = 2;
    } else if (plan === '999' || plan === 'basic' || plan === 'starter') {
      maxTotal = 1;
      maxPerBranch = 1;
    } else {
      return NextResponse.json({ error: 'Active subscription required to add staff' }, { status: 403 });
    }

    // Check current usage
    const { data: currentStaff } = await supabaseAdmin
      .from('users')
      .select('branch_name')
      .eq('owner_id', owner_id)
      .eq('role', 'employee');

    const staffCount = currentStaff?.length || 0;
    if (staffCount >= maxTotal) {
      return NextResponse.json({ error: `Maximum total staff limit (${maxTotal}) reached for your plan.` }, { status: 403 });
    }

    const branchCount = currentStaff?.filter(s => s.branch_name === branch_name).length || 0;
    if (branchCount >= maxPerBranch) {
      return NextResponse.json({ error: `${branch_name} has reached its staff limit (${maxPerBranch} staff).` }, { status: 403 });
    }

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

    // 3. Upsert into public.users to create or overwrite the profile
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .upsert({
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
      console.error('Staff linking failed:', dbError);
      return NextResponse.json({ error: `Failed to link staff account: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    console.error('Staff API error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    const { staff_id, owner_id } = await req.json();

    if (!staff_id || !owner_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (!authUser || authUser.id !== owner_id) {
      return NextResponse.json({ error: 'Unauthorized: Active owner session required' }, { status: 401 });
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

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    const { staff_id, owner_id, full_name, branch_name, staff_role, password } = await req.json();

    if (!staff_id || !owner_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (!authUser || authUser.id !== owner_id) {
      return NextResponse.json({ error: 'Unauthorized: Active owner session required' }, { status: 401 });
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

    // Update public.users
    const updates: any = {};
    if (full_name) updates.full_name = full_name;
    if (branch_name) updates.branch_name = branch_name;
    if (staff_role) updates.staff_role = staff_role;

    if (Object.keys(updates).length > 0) {
      const { error: dbError } = await supabaseAdmin
        .from('users')
        .update(updates)
        .eq('id', staff_id);
      
      if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 500 });
      }
    }

    // Update auth credentials if password provided
    if (password) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(staff_id, {
        password: password
      });
      if (authError) {
        return NextResponse.json({ error: `Password update failed: ${authError.message}` }, { status: 500 });
      }
    }

    // Update full name in auth metadata if changed
    if (full_name) {
      await supabaseAdmin.auth.admin.updateUserById(staff_id, {
        user_metadata: { full_name }
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
