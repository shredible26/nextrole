import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: {
    type: string;
    table: string;
    record: {
      id: string;
      email: string;
      raw_user_meta_data?: { full_name?: string; avatar_url?: string };
    };
  };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.type !== 'INSERT' || payload.table !== 'users') {
    return NextResponse.json({ received: true });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { id, email, raw_user_meta_data } = payload.record;

  const { error } = await supabase.from('profiles').insert({
    id,
    email,
    full_name: raw_user_meta_data?.full_name ?? null,
    avatar_url: raw_user_meta_data?.avatar_url ?? null,
  });

  if (error) {
    console.error('[auth/webhook] profile insert error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
