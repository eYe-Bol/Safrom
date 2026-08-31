import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdminCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') return null;
  return user;
}

export async function GET() {
  try {
    const adminUser = await verifyAdminCaller();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized: Admin access only' }, { status: 403 });
    }

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, store_name, store_phone, role, scale, subscription_plan, subscription_status, subscription_end_date, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const adminUser = await verifyAdminCaller();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized: Admin access only' }, { status: 403 });
    }

    const body = await req.json();
    const { targetUserId, action, days, plan, scale, isActive, customEndDate } = body;

    if (!targetUserId || !action) {
      return NextResponse.json({ error: 'Missing targetUserId or action' }, { status: 400 });
    }

    const { data: targetUser, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (fetchErr || !targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    let updates: Record<string, any> = {};

    if (action === 'extend') {
      let baseDate = new Date();
      if (targetUser.subscription_end_date && new Date(targetUser.subscription_end_date) > baseDate) {
        baseDate = new Date(targetUser.subscription_end_date);
      }
      
      const addDays = Number(days) || 30;
      baseDate.setDate(baseDate.getDate() + addDays);

      updates = {
        subscription_status: 'active',
        subscription_end_date: baseDate.toISOString(),
        is_active: true,
      };
      if (plan) updates.subscription_plan = plan;
    } else if (action === 'set_custom_date') {
      if (!customEndDate) {
        return NextResponse.json({ error: 'customEndDate is required' }, { status: 400 });
      }
      updates = {
        subscription_status: 'active',
        subscription_end_date: new Date(customEndDate).toISOString(),
        is_active: true,
      };
      if (plan) updates.subscription_plan = plan;
    } else if (action === 'exempt') {
      // Permanent lifetime exemption
      updates = {
        subscription_status: 'exempt',
        subscription_plan: 'exempt',
        is_active: true,
      };
    } else if (action === 'set_scale') {
      if (scale !== 'single' && scale !== 'multi') {
        return NextResponse.json({ error: 'Invalid scale' }, { status: 400 });
      }
      updates = { scale };
    } else if (action === 'set_plan') {
      updates = { subscription_plan: plan };
      if (scale) updates.scale = scale;
    } else if (action === 'toggle_active') {
      updates = { is_active: isActive !== undefined ? isActive : !targetUser.is_active };
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', targetUserId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
