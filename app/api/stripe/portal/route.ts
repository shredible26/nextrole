import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('Stripe billing portal auth lookup failed', {
        error: authError.message,
      })
      return NextResponse.json({ error: 'Unable to verify user session' }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = adminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Stripe billing portal profile lookup failed', {
        error: profileError.message,
        userId: user.id,
      })
      return NextResponse.json({ error: 'Unable to load billing profile' }, { status: 500 })
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer ID found for this account.' },
        { status: 400 }
      )
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: new URL('/subscription', request.url).toString(),
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Stripe billing portal session creation failed', {
      error: error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
          }
        : error,
    })

    return NextResponse.json(
      { error: 'Unable to create billing portal session' },
      { status: 500 }
    )
  }
}
