import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const VALID_LEVELS = new Set(['New Grad', 'Entry Level', 'Internship']);
const VALID_ROLES = new Set(['SWE', 'DS', 'ML', 'AI', 'DevOps', 'Security', 'PM', 'Analyst', 'Finance', 'Consulting']);

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { target_levels?: unknown; target_roles?: unknown };
  try {
    body = await req.json() as { target_levels?: unknown; target_roles?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const target_levels = Array.isArray(body.target_levels)
    ? body.target_levels.filter((v): v is string => typeof v === 'string' && VALID_LEVELS.has(v))
    : [];

  const target_roles = Array.isArray(body.target_roles)
    ? body.target_roles.filter((v): v is string => typeof v === 'string' && VALID_ROLES.has(v))
    : [];

  const { error } = await supabase
    .from('profiles')
    .update({ target_levels, target_roles })
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
