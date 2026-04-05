import { NextResponse } from 'next/server';

// TODO Week 2: Stripe webhook — handle checkout.session.completed and subscription.deleted
export async function POST() {
  return NextResponse.json({ received: true });
}
