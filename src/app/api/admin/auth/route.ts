import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MASTER_PIN = process.env.ADMIN_SECURITY_PIN || 'SFS@2026#Admin';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sfs-admin-secret-key-salt';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Please log in first' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Super Admin role required' }, { status: 403 });
    }

    const body = await req.json();
    const { pin } = body;

    if (!pin) {
      return NextResponse.json({ error: 'Security PIN / Password is required' }, { status: 400 });
    }

    if (pin !== MASTER_PIN) {
      return NextResponse.json({ error: 'Incorrect Admin Security PIN' }, { status: 401 });
    }

    // Generate signed 4-hour token
    const timestamp = Date.now();
    const payload = `${user.id}:${timestamp}`;
    const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
    const token = `${Buffer.from(payload).toString('base64')}.${signature}`;

    return NextResponse.json({
      success: true,
      token,
      message: 'Admin console unlocked successfully',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
