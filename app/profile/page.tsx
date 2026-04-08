import { redirect } from 'next/navigation';
import ProfileClient from '@/components/ProfileClient';
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
};

export default async function ProfilePage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/jobs');
  }

  const [{ data: profileWithDisplayName, error: profileError }, { count, error: countError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, display_name, tier, stripe_subscription_id, subscription_status')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

  let profile = profileWithDisplayName as ProfileRecord | null;

  if (profileError) {
    console.error('[profile/page] profile query error:', profileError.message);

    const { data: fallbackProfile, error: fallbackError } = await supabase
      .from('profiles')
      .select('id, email, tier, stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .maybeSingle();

    if (fallbackError) {
      console.error('[profile/page] fallback profile query error:', fallbackError.message);
    } else if (fallbackProfile) {
      profile = {
        ...(fallbackProfile as Omit<ProfileRecord, 'display_name'>),
        display_name: null,
      };
    }
  }

  if (countError) {
    console.error('[profile/page] application count error:', countError.message);
  }

  return (
    <ProfileClient
      userId={user.id}
      email={profile?.email ?? user.email ?? ''}
      displayName={profile?.display_name ?? null}
      tier={profile?.tier === 'pro' ? 'pro' : 'free'}
      subscriptionStatus={profile?.subscription_status ?? null}
      applicationCount={count ?? 0}
    />
  );
}
