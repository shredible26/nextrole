import { redirect } from 'next/navigation';
import ProfileClient from '@/components/ProfileClient';
import { normalizeInterviewCount } from '@/lib/interviews';
import { createServerClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Profile — NextRole',
  description: 'Manage your profile, plan, and resume.',
};

type ProfileRecord = {
  id: string;
  email: string | null;
  display_name: string | null;
  tier: 'free' | 'pro' | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  target_levels: string[] | null;
  target_roles: string[] | null;
  job_alerts_enabled: boolean | null;
};

export default async function ProfilePage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/jobs');
  }

  const [
    { data: profileWithDisplayName, error: profileError },
    { count, error: countError },
    { data: interviewRows, error: interviewCountError },
  ] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, display_name, tier, stripe_subscription_id, subscription_status, target_levels, target_roles, job_alerts_enabled')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('applications')
        .select('interview_count')
        .eq('user_id', user.id),
    ]);

  let profile = profileWithDisplayName as ProfileRecord | null;

  if (profileError) {
    console.error('[profile/page] profile query error:', profileError.message);

    const { data: fallbackProfileWithDisplayName, error: fallbackDisplayNameError } = await supabase
      .from('profiles')
      .select('id, email, display_name, tier, stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    if (!fallbackDisplayNameError && fallbackProfileWithDisplayName) {
      profile = {
        ...(fallbackProfileWithDisplayName as Omit<ProfileRecord, 'target_levels' | 'target_roles'>),
        target_levels: [],
        target_roles: [],
      };
    } else {
      if (fallbackDisplayNameError) {
        console.error('[profile/page] fallback profile query with display_name error:', fallbackDisplayNameError.message);
      }

      const { data: fallbackProfile, error: fallbackError } = await supabase
        .from('profiles')
        .select('id, email, tier, stripe_subscription_id, subscription_status')
        .eq('id', user.id)
        .maybeSingle();

      if (fallbackError) {
        console.error('[profile/page] fallback profile query error:', fallbackError.message);
      } else if (fallbackProfile) {
        profile = {
          ...(fallbackProfile as Omit<ProfileRecord, 'display_name' | 'target_levels' | 'target_roles'>),
          display_name: null,
          target_levels: [],
          target_roles: [],
        };
      }
    }
  }

  if (countError) {
    console.error('[profile/page] application count error:', countError.message);
  }

  if (interviewCountError) {
    console.error('[profile/page] interview count query error:', interviewCountError.message);
  }

  const interviewCount = (interviewRows ?? []).reduce(
    (total, application) => total + normalizeInterviewCount(application.interview_count),
    0,
  );

  return (
    <ProfileClient
      userId={user.id}
      email={profile?.email ?? user.email ?? ''}
      displayName={profile?.display_name ?? null}
      tier={profile?.tier === 'pro' ? 'pro' : 'free'}
      subscriptionStatus={profile?.subscription_status ?? null}
      applicationCount={count ?? 0}
      interviewCount={interviewCount}
      initialTargetLevels={Array.isArray(profile?.target_levels) ? profile.target_levels : []}
      initialTargetRoles={Array.isArray(profile?.target_roles) ? profile.target_roles : []}
      initialJobAlertsEnabled={profile?.job_alerts_enabled ?? false}
    />
  );
}
