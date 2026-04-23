import {
  getMinimumInterviewCountForStatus,
  getNextInterviewCount,
  normalizeInterviewCount,
} from '@/lib/interviews';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/lib/types';
import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const APPLICATION_STATUS_SET = new Set<ApplicationStatus>(APPLICATION_STATUSES);

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { count, error } = await supabase
    .from('applications')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count || count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { data: existingApplication, error: existingApplicationError } = await supabase
    .from('applications')
    .select('status, interview_count')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingApplicationError) {
    return NextResponse.json({ error: existingApplicationError.message }, { status: 500 });
  }

  if (!existingApplication) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Build partial update — only include fields that were sent
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !APPLICATION_STATUS_SET.has(body.status as ApplicationStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    updateData.status = body.status;
  }
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.interview_count !== undefined) {
    const effectiveStatus = (body.status ?? existingApplication.status) as ApplicationStatus;
    const minimumInterviewCount = getMinimumInterviewCountForStatus(effectiveStatus);

    if (
      typeof body.interview_count !== 'number'
      || !Number.isInteger(body.interview_count)
      || body.interview_count < minimumInterviewCount
    ) {
      return NextResponse.json({ error: 'Invalid interview count' }, { status: 400 });
    }

    updateData.interview_count = body.interview_count;
  } else if (body.status !== undefined) {
    updateData.interview_count = getNextInterviewCount({
      currentStatus: existingApplication.status as ApplicationStatus,
      nextStatus: body.status as ApplicationStatus,
      currentCount: normalizeInterviewCount(existingApplication.interview_count),
    });
  }

  const { error } = await supabase
    .from('applications')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id); // RLS double-check

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
