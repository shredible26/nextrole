import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const VALID_LEVELS = new Set(['New Grad', 'Entry Level', 'Internship']);
const VALID_ROLES = new Set(['SWE', 'DS', 'ML', 'AI', 'DevOps', 'Security', 'PM', 'Analyst', 'Finance', 'Consulting']);

type PreferencesPayload = {
  target_levels?: unknown;
  target_roles?: unknown;
};

function sanitizeSelections(value: unknown, validValues: ReadonlySet<string>) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const selections: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    const trimmed = entry.trim();

    if (!trimmed || !validValues.has(trimmed) || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    selections.push(trimmed);
  }

  return selections;
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PreferencesPayload;
  try {
    body = await req.json() as PreferencesPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.target_levels !== undefined && !Array.isArray(body.target_levels)) {
    return NextResponse.json({ error: 'target_levels must be an array' }, { status: 400 });
  }

  if (body.target_roles !== undefined && !Array.isArray(body.target_roles)) {
    return NextResponse.json({ error: 'target_roles must be an array' }, { status: 400 });
  }

  const updates: { target_levels?: string[]; target_roles?: string[] } = {};

  if (body.target_levels !== undefined) {
    updates.target_levels = sanitizeSelections(body.target_levels, VALID_LEVELS);
  }

  if (body.target_roles !== undefined) {
    updates.target_roles = sanitizeSelections(body.target_roles, VALID_ROLES);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    const isMigrationError = /target_levels|target_roles/i.test(error.message);

    return NextResponse.json(
      {
        error: isMigrationError
          ? 'Run the target_levels and target_roles ALTER TABLE statements in Supabase before saving job preferences.'
          : error.message,
      },
      { status: isMigrationError ? 400 : 500 }
    );
  }

  return NextResponse.json({ success: true, ...updates });
}
