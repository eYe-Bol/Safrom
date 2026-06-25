import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { storeId, plan, months, amount, email, name } = await req.json();

    if (!storeId || !plan || !months || !amount || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const INTASEND_PUBLISHABLE_KEY = process.env.INTASEND_PUBLISHABLE_KEY;
    const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY;
    // Replace with local testing URL when in development
    const HOST = process.env.NEXT_PUBLIC_BASE_URL || 'https://safrom.vercel.app'; 

    if (!INTASEND_PUBLISHABLE_KEY || !INTASEND_SECRET_KEY) {
      return NextResponse.json({ error: 'Intasend keys not configured on server' }, { status: 500 });
    }

    // Prepare payload for Intasend
    // api_ref allows us to track this specific transaction in the webhook
    const apiRef = `${storeId}_${plan}_${months}_${Date.now()}`;

    const payload = {
      public_key: INTASEND_PUBLISHABLE_KEY,
      amount: amount,
      currency: 'KES',
      email: email,
      first_name: name || 'SFS',
      last_name: 'User',
      host: HOST,
      redirect_url: `${HOST}/portal/settings?payment=success`,
      api_ref: apiRef,
    };

    const response = await fetch('https://payment.intasend.com/api/v1/checkout/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTASEND_SECRET_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Intasend Checkout Error:', data);
      return NextResponse.json({ error: 'Payment gateway error', details: data }, { status: response.status });
    }

    return NextResponse.json({ url: data.url });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
