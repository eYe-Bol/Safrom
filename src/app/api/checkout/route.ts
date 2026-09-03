import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { storeId, plan, months, amount, email, name, outlets, isAddon } = await req.json();

    if (!storeId || !plan || !months || !amount || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const INTASEND_PUBLISHABLE_KEY = process.env.INTASEND_PUBLISHABLE_KEY;
    const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY;
    const HOST = process.env.NEXT_PUBLIC_BASE_URL || 'https://safrombusiness.co.ke'; 

    if (!INTASEND_PUBLISHABLE_KEY || !INTASEND_SECRET_KEY) {
      return NextResponse.json({ error: 'Intasend keys not configured on server' }, { status: 500 });
    }

    const IntaSend = require('intasend-node');
    const intasend = new IntaSend(
      INTASEND_PUBLISHABLE_KEY,
      INTASEND_SECRET_KEY,
      false // test mode = false
    );

    const outletCount = parseInt(String(outlets || 1), 10) || 1;
    const actionType = isAddon ? 'ADDON' : 'RENEW';
    const apiRef = `${storeId}_${plan}_${months}_${outletCount}_${actionType}_${Date.now()}`;

    // IntaSend customer name validation:
    // Disallows full stops ('.'), symbols, commas, quotes, etc.
    // Must be a clean alphanumeric string with only letters, digits, spaces, hyphens, or underscores.
    let firstName = 'Safrom';
    let lastName = 'User';

    if (name && typeof name === 'string') {
      const cleaned = name
        .replace(/[.]/g, '')
        .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
      const words = cleaned.split(' ').filter(Boolean);
      if (words.length >= 2) {
        firstName = words[0].slice(0, 30);
        lastName = words.slice(1).join(' ').slice(0, 30);
      } else if (words.length === 1 && words[0]) {
        firstName = words[0].slice(0, 30);
        lastName = 'User';
      }
    } else if (email && typeof email === 'string') {
      const emailPrefix = email.split('@')[0].replace(/[.]/g, '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (emailPrefix) {
        firstName = emailPrefix.slice(0, 30);
      }
    }

    const collection = intasend.collection();
    const response = await collection.charge({
      first_name: firstName,
      last_name: lastName,
      email: email,
      host: HOST,
      amount: amount,
      currency: 'KES',
      api_ref: apiRef,
      redirect_url: `${HOST}/portal/settings?payment=success`
    });

    return NextResponse.json({ url: response.url });
  } catch (err: any) {
    console.error('Checkout error:', err);

    let errorText = 'Payment initiation failed. Please try again.';

    if (Buffer.isBuffer(err)) {
      try {
        const rawStr = err.toString('utf8');
        const parsed = JSON.parse(rawStr);
        if (parsed.errors && Array.isArray(parsed.errors)) {
          errorText = parsed.errors
            .map((e: any) => e.message || (typeof e === 'string' ? e : JSON.stringify(e)))
            .join(', ');
        } else if (parsed.message) {
          errorText = parsed.message;
        } else if (parsed.detail) {
          errorText = parsed.detail;
        } else {
          errorText = rawStr;
        }
      } catch {
        errorText = err.toString('utf8');
      }
    } else if (typeof err === 'string') {
      errorText = err;
    } else if (err?.message) {
      errorText = err.message;
    }

    return NextResponse.json({ error: errorText }, { status: 400 });
  }
}
