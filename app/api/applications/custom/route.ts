import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getMinimumInterviewCountForStatus } from "@/lib/interviews";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";
import { createServerClient } from "@/lib/supabase/server";

const APPLICATION_STATUS_SET = new Set<ApplicationStatus>(APPLICATION_STATUSES);

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const status = typeof body.status === "string" ? body.status : "";
  const dateApplied = typeof body.dateApplied === "string" ? new Date(body.dateApplied) : null;
  const jobUrl = typeof body.jobUrl === "string" ? body.jobUrl.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!jobTitle || !company) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!APPLICATION_STATUS_SET.has(status as ApplicationStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (!dateApplied || Number.isNaN(dateApplied.getTime())) {
    return NextResponse.json({ error: "Invalid applied date" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (profile?.tier === "free") {
    const { count } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= 100) {
      return NextResponse.json(
        { error: "Tracker limit reached", upgrade: true, reason: "tracker" },
        { status: 402 }
      );
    }
  }

  const admin = createAdminClient();
  const dedupHash = `custom:${user.id}:${crypto.randomUUID()}`;

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .insert({
      source: "custom",
      source_id: dedupHash,
      title: jobTitle,
      company,
      url: jobUrl || "#",
      location: null,
      remote: false,
      experience_level: "entry_level",
      roles: [],
      is_active: false,
      dedup_hash: dedupHash,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message ?? "Failed to create job" },
      { status: 500 }
    );
  }

  const applicationStatus = status as ApplicationStatus;
  const { data: application, error: applicationError } = await admin
    .from("applications")
    .insert({
      user_id: user.id,
      job_id: job.id,
      status: applicationStatus,
      applied_at: dateApplied.toISOString(),
      notes: notes || null,
      auto_tracked: false,
      interview_count: getMinimumInterviewCountForStatus(applicationStatus),
    })
    .select("*, job:jobs(*)")
    .single();

  if (applicationError) {
    await admin.from("jobs").delete().eq("id", job.id);

    return NextResponse.json(
      { error: applicationError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, application });
}
