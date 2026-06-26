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

    const IntaSend = require('intasend-node');
    const intasend = new IntaSend(
      INTASEND_PUBLISHABLE_KEY,
      INTASEND_SECRET_KEY,
      false // test mode = false
    );

    const apiRef = `${storeId}_${plan}_${months}_${Date.now()}`;

    const collection = intasend.collection();
    const response = await collection.charge({
      first_name: name || 'SFS',
      last_name: 'User',
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
    return NextResponse.json({ error: err.message || 'Internal Server Error', details: err }, { status: 500 });
  }
}
