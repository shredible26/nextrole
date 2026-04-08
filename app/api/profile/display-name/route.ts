import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { displayName?: unknown };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.displayName !== 'string') {
    return NextResponse.json({ error: 'displayName is required' }, { status: 400 });
  }

  const displayName = body.displayName.trim();

  if (displayName.length < 1 || displayName.length > 50) {
    return NextResponse.json(
      { error: 'Display name must be between 1 and 50 characters' },
      { status: 400 }
    );
  }

  if (/<[^>]+>/.test(displayName)) {
    return NextResponse.json(
      { error: 'Display name cannot contain HTML tags' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id);

  if (error) {
    const isMigrationError = error.message.includes('display_name');

    return NextResponse.json(
      {
        error: isMigrationError
          ? 'Run the display_name migration in Supabase before updating your name.'
          : error.message,
      },
      { status: isMigrationError ? 400 : 500 }
    );
  }

  return NextResponse.json({ success: true });
}
