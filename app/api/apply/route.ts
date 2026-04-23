import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { job_id } = await req.json();

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  if (profile?.tier === 'free') {
    const { count } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count ?? 0) >= 100) {
      return Response.json(
        { error: 'Tracker limit reached', upgrade: true, reason: 'tracker' },
        { status: 402 }
      );
    }
  }

  const { error } = await supabase.from('applications').upsert({
    user_id: user.id,
    job_id,
    status: 'applied',
    interview_count: 0,
    auto_tracked: true,
    applied_at: new Date().toISOString(),
  }, { onConflict: 'user_id,job_id', ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
