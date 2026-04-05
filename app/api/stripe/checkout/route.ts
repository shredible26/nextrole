import { NextResponse } from 'next/server';

// TODO Week 2: Stripe checkout — configure STRIPE_SECRET_KEY first
export async function POST() {
  return NextResponse.json({ error: 'Stripe not yet configured' }, { status: 501 });
}
