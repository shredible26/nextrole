import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/', requestUrl.origin))
  }

  const cookieStore = await cookies()
  const response = NextResponse.redirect(new URL('/jobs', requestUrl.origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    console.error('[auth/callback] error:', error?.message)
    return NextResponse.redirect(new URL('/?error=auth', requestUrl.origin))
  }

  // Upsert profile using service role client
  const serviceClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const displayName = user.user_metadata?.full_name
    ?? user.user_metadata?.name
    ?? null

  let shouldIncludeDisplayName = false

  if (displayName) {
    const { data: existingProfile, error: existingProfileError } = await serviceClient
      .from('profiles')
      .select('id, display_name')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfileError) {
      console.error('[auth/callback] profile lookup error:', existingProfileError.message)
    } else {
      shouldIncludeDisplayName = !existingProfile?.display_name
    }
  }

  const { error: profileUpsertError } = await serviceClient.from('profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    ...(displayName && shouldIncludeDisplayName ? { display_name: displayName } : {}),
  }, { onConflict: 'id', ignoreDuplicates: false })

  if (profileUpsertError) {
    console.error('[auth/callback] profile upsert error:', profileUpsertError.message)
  }

  return response
}
