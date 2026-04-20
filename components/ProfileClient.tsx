'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { BellRing, Briefcase, CheckCircle2, Crown, DollarSign, Loader2, Mail, MapPin, Pencil, Trash2, TrendingUp, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const LEVEL_OPTIONS = ['New Grad', 'Entry Level', 'Internship'] as const;
const ROLE_OPTIONS = ['SWE', 'DS', 'ML', 'AI', 'DevOps', 'Security', 'PM', 'Analyst', 'Finance', 'Consulting'] as const;

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;

type ResumeInfo = {
  name: string;
  uploadedAt: string | null;
};

type LevelOption = (typeof LEVEL_OPTIONS)[number];
type RoleOption = (typeof ROLE_OPTIONS)[number];

export interface ProfileClientProps {
  userId: string;
  email: string;
  displayName: string | null;
  tier: 'free' | 'pro';
  subscriptionStatus: string | null;
  applicationCount: number;
  initialTargetLevels: string[];
  initialTargetRoles: string[];
  initialJobAlertsEnabled: boolean;
}

function sortSelections<T extends string>(values: string[], options: readonly T[]) {
  const uniqueValidValues = Array.from(new Set(values)).filter((value): value is T => (
    options.includes(value as T)
  ));

  return [...uniqueValidValues].sort((left, right) => options.indexOf(left) - options.indexOf(right));
}

function areSelectionsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function getInitials(displayName: string | null, email: string) {
  const trimmedName = displayName?.trim();

  if (trimmedName) {
    const letters = trimmedName
      .split(/\s+/)
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();

    if (letters) {
      return letters;
    }
  }

  return email.split('@')[0]?.[0]?.toUpperCase() ?? 'U';
}

async function getResumeInfo(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .storage
    .from('resumes')
    .list(userId, { limit: 1, search: 'resume.pdf' });

  if (error) {
    return { resume: null as ResumeInfo | null, error };
  }

  const file = data.find((item) => item.name === 'resume.pdf');

  if (!file) {
    return { resume: null as ResumeInfo | null, error: null };
  }

  return {
    resume: {
      name:
        typeof file.metadata?.originalName === 'string'
          ? file.metadata.originalName
          : file.name,
      uploadedAt: file.updated_at ?? file.created_at,
    },
    error: null,
  };
}

function formatUploadDate(value: string | null) {
  if (!value) {
    return 'Uploaded recently';
  }

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProfileClient(props: ProfileClientProps) {
  const {
    userId,
    email,
    displayName,
    tier,
    applicationCount,
    initialTargetLevels,
    initialTargetRoles,
    initialJobAlertsEnabled,
  } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentDisplayName, setCurrentDisplayName] = useState(displayName);
  const [draftDisplayName, setDraftDisplayName] = useState(displayName ?? '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isDeletingResume, setIsDeletingResume] = useState(false);
  const [targetLevels, setTargetLevels] = useState(() => sortSelections(initialTargetLevels, LEVEL_OPTIONS));
  const [targetRoles, setTargetRoles] = useState(() => sortSelections(initialTargetRoles, ROLE_OPTIONS));
  const [savedTargetLevels, setSavedTargetLevels] = useState(() => sortSelections(initialTargetLevels, LEVEL_OPTIONS));
  const [savedTargetRoles, setSavedTargetRoles] = useState(() => sortSelections(initialTargetRoles, ROLE_OPTIONS));
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [jobAlertsEnabled, setJobAlertsEnabled] = useState(initialJobAlertsEnabled);
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadResume() {
      const { resume: existingResume, error } = await getResumeInfo(userId);

      if (!active) {
        return;
      }

      if (error) {
        console.error('[profile] resume lookup error:', error.message);
      }

      setResume(existingResume);
      setIsLoadingResume(false);
    }

    void loadResume();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    const nextLevels = sortSelections(initialTargetLevels, LEVEL_OPTIONS);
    const nextRoles = sortSelections(initialTargetRoles, ROLE_OPTIONS);

    setTargetLevels(nextLevels);
    setTargetRoles(nextRoles);
    setSavedTargetLevels(nextLevels);
    setSavedTargetRoles(nextRoles);
  }, [initialTargetLevels, initialTargetRoles, userId]);

  async function refreshResume() {
    const { resume: existingResume, error } = await getResumeInfo(userId);

    if (error) {
      console.error('[profile] resume refresh error:', error.message);
      setResume(null);
      return;
    }

    setResume(existingResume);
  }

  function handleStartEditing() {
    setDraftDisplayName(currentDisplayName ?? '');
    setIsEditingName(true);
  }

  function handleCancelEditing() {
    setDraftDisplayName(currentDisplayName ?? '');
    setIsEditingName(false);
  }

  async function handleSaveName() {
    const trimmedName = draftDisplayName.trim();

    if (trimmedName.length < 1 || trimmedName.length > 50) {
      toast.error('Name must be between 1 and 50 characters');
      return;
    }

    if (/<[^>]+>/.test(trimmedName)) {
      toast.error('Name cannot include HTML');
      return;
    }

    if (trimmedName === (currentDisplayName ?? '')) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);

    try {
      const res = await fetch('/api/profile/display-name', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmedName }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(
          typeof data.error === 'string' ? data.error : 'Failed to update name'
        );
        return;
      }

      setCurrentDisplayName(trimmedName);
      setDraftDisplayName(trimmedName);
      setIsEditingName(false);
      toast.success('Name updated');
    } catch {
      toast.error('Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  }

  function toggleLevel(level: LevelOption) {
    setTargetLevels((prev) => (
      prev.includes(level)
        ? prev.filter((item) => item !== level)
        : sortSelections([...prev, level], LEVEL_OPTIONS)
    ));
  }

  function toggleRole(role: RoleOption) {
    setTargetRoles((prev) => (
      prev.includes(role)
        ? prev.filter((item) => item !== role)
        : sortSelections([...prev, role], ROLE_OPTIONS)
    ));
  }

  async function handleSavePreferences() {
    setIsSavingPrefs(true);
    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_levels: targetLevels, target_roles: targetRoles }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Failed to save preferences');
        return;
      }
      setSavedTargetLevels(targetLevels);
      setSavedTargetRoles(targetRoles);
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setIsSavingPrefs(false);
    }
  }

  async function handleToggleAlerts() {
    const nextValue = !jobAlertsEnabled;
    setJobAlertsEnabled(nextValue);
    setIsSavingAlerts(true);
    try {
      const res = await fetch('/api/profile/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJobAlertsEnabled(!nextValue);
        toast.error(typeof data.error === 'string' ? data.error : 'Failed to update alerts');
      }
    } catch {
      setJobAlertsEnabled(!nextValue);
      toast.error('Failed to update alerts');
    } finally {
      setIsSavingAlerts(false);
    }
  }

  async function handleResumeSelected(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      toast.error('PDF files only');
      input.value = '';
      return;
    }

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      toast.error('File too large (max 5MB)');
      input.value = '';
      return;
    }

    setIsUploadingResume(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.storage
        .from('resumes')
        .upload(`${userId}/resume.pdf`, file, {
          contentType: 'application/pdf',
          upsert: true,
          metadata: { originalName: file.name },
        });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Write storage path back to profile so embed-resume and other callers can rely on it
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ resume_url: `${userId}/resume.pdf` })
        .eq('id', userId);

      if (profileError) {
        console.error('[profile] failed to update resume_url:', profileError.message);
      }

      await refreshResume();
      toast.success('Resume uploaded successfully');

      // Analyze resume in background — non-blocking
      toast.loading('Analyzing resume...', { id: 'resume-embed' });
      try {
        const embedRes = await fetch('/api/profile/embed-resume', { method: 'POST' });
        if (embedRes.ok) {
          toast.success('Resume analyzed ✓ — match scores are now active', { id: 'resume-embed' });
        } else {
          toast.warning('Resume uploaded but analysis failed — try re-uploading', { id: 'resume-embed' });
        }
      } catch {
        toast.warning('Resume uploaded but analysis failed — try re-uploading', { id: 'resume-embed' });
      }
    } catch {
      toast.error('Failed to upload resume');
    } finally {
      setIsUploadingResume(false);
      input.value = '';
    }
  }

  async function handleDeleteResume() {
    setIsDeletingResume(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.storage
        .from('resumes')
        .remove([`${userId}/resume.pdf`]);

      if (error) {
        toast.error(error.message);
        return;
      }

      setResume(null);
      toast.success('Resume deleted');
    } catch {
      toast.error('Failed to delete resume');
    } finally {
      setIsDeletingResume(false);
    }
  }

  const initials = getInitials(currentDisplayName, email);
  const displayNameLabel = currentDisplayName?.trim() || 'Add your name';
  const canSaveName =
    !isSavingName &&
    draftDisplayName.trim().length >= 1 &&
    draftDisplayName.trim().length <= 50;
  const hasUnsavedPreferences =
    !areSelectionsEqual(targetLevels, savedTargetLevels) ||
    !areSelectionsEqual(targetRoles, savedTargetRoles);
  const totalPreferencesSelected = targetLevels.length + targetRoles.length;
  const resumeReady = !isLoadingResume && resume !== null;
  const rolesReady = savedTargetRoles.length > 0;
  const alertsRequirementsMet = resumeReady && rolesReady;
  const isToggleDisabled = !alertsRequirementsMet || isSavingAlerts;
  const showAlertHint = !isLoadingResume && !alertsRequirementsMet && !isSavingAlerts;

  return (
    <div className="min-h-screen w-full bg-[#0d0d12] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Profile identity */}
        <div className="relative overflow-hidden rounded-3xl bg-[#1a1a24] border-0 shadow-2xl group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {!isEditingName && (
            <button
              onClick={handleStartEditing}
              aria-label="Edit display name"
              className="absolute top-5 right-5 md:top-8 md:right-8 z-20 flex items-center gap-1.5 border border-indigo-500/30 bg-transparent text-indigo-400 text-sm rounded-xl px-3 py-2 transition-all duration-200 hover:bg-indigo-500/10 hover:border-indigo-500/60"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden md:inline">Edit</span>
            </button>
          )}

          <div className="relative z-10 p-5 md:p-8">
            <div className={cn(
              'flex flex-col md:flex-row items-center md:items-start gap-6',
              !isEditingName && 'pr-14 md:pr-32'
            )}>
              <div className="h-20 w-20 shrink-0 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-2xl font-bold select-none">
                {initials}
              </div>

              <div className="flex-1 flex flex-col items-center md:items-start gap-2 min-w-0">
                {isEditingName ? (
                  <div className="flex w-full max-w-sm flex-col gap-3">
                    <Input
                      value={draftDisplayName}
                      onChange={(event) => setDraftDisplayName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleSaveName();
                        }
                        if (event.key === 'Escape') {
                          handleCancelEditing();
                        }
                      }}
                      placeholder="Enter your display name"
                      maxLength={50}
                      className="bg-[#0d0d12] border-[#2a2a35] text-[#f0f0fa] placeholder:text-[#555566] rounded-lg text-center"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => void handleSaveName()}
                        disabled={!canSaveName}
                        className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                      >
                        {isSavingName ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving...
                          </span>
                        ) : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEditing}
                        disabled={isSavingName}
                        className="bg-[#2a2a35] hover:bg-[#3a3a45] text-[#f0f0fa] text-sm px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold text-[#f0f0fa] tracking-tight">{displayNameLabel}</h1>
                    <p className="text-sm text-[#888899]">{email}</p>
                    <div className="mt-1">
                      {tier === 'pro' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 text-xs font-semibold text-amber-300">
                          <Crown className="h-3 w-3" />
                          Pro
                        </span>
                      ) : (
                        <Link href="/pricing" className="inline-flex rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-400">
                          Upgrade to Pro →
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative overflow-hidden rounded-3xl bg-[#1a1a24] border-0 shadow-2xl group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 p-5 md:p-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-indigo-500/10 rounded-2xl">
                  <Briefcase className="w-6 h-6 text-indigo-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-[#888899] mb-1">Applications</p>
                <p className="text-4xl font-bold text-white">{applicationCount}</p>
              </div>
              <div className="pt-2 border-t border-[#2a2a35]">
                <p className="text-xs text-[#555566]">applications tracked</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-[#1a1a24] border-0 shadow-2xl group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 p-5 md:p-8 space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-purple-500/10 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6 text-purple-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-[#888899] mb-1">Interviews</p>
                <p className="text-4xl font-bold text-white">—</p>
              </div>
              <div className="pt-2 border-t border-[#2a2a35]">
                <p className="text-xs text-[#555566]">coming soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* Resume + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resume */}
          <div className="relative overflow-hidden rounded-3xl bg-[#1a1a24] border-0 shadow-2xl group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 p-5 md:p-8 flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 rounded-2xl shrink-0">
                  <Upload className="h-5 w-5 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Resume</h2>
                  <p className="text-sm text-[#888899]">Upload a PDF up to 5MB.</p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={handleResumeSelected}
              />

              {isLoadingResume ? (
                <div className="border border-dashed border-[#2a2a35] rounded-2xl p-8 text-center">
                  <Loader2 className="text-[#555566] h-5 w-5 animate-spin mx-auto mb-2" />
                  <p className="text-[#555566] text-sm">Checking for an existing resume...</p>
                </div>
              ) : resume ? (
                <div className="bg-[#0d0d12]/50 rounded-2xl border border-[#2a2a35] p-4">
                  <p className="text-[#f0f0fa] font-medium">{resume.name}</p>
                  <p className="text-[#888899] text-sm mt-0.5">Uploaded {formatUploadDate(resume.uploadedAt)}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingResume || isDeletingResume}
                      className="border border-[#2a2a35] bg-transparent text-[#f0f0fa] hover:bg-[#2a2a35] rounded-xl px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
                    >
                      {isUploadingResume ? (
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Uploading...
                        </span>
                      ) : 'Replace'}
                    </button>
                    <button
                      onClick={() => void handleDeleteResume()}
                      disabled={isUploadingResume || isDeletingResume}
                      className="bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 rounded-xl px-3 py-1.5 text-sm inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isDeletingResume ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Deleting...</>
                      ) : (
                        <><Trash2 className="h-3.5 w-3.5" />Delete</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-[#2a2a35] rounded-2xl p-8 text-center hover:border-indigo-500/50 transition-colors duration-300">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-indigo-500/10 rounded-full">
                      <Upload className="w-8 h-8 text-indigo-400" />
                    </div>
                  </div>
                  <p className="text-[#f0f0fa] font-medium mb-1">Upload your resume</p>
                  <p className="text-[#888899] text-sm mb-1">Keep one current copy ready for applications.</p>
                  <p className="text-[#555566] text-xs mb-4">PDF only (Max 5MB)</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingResume || isDeletingResume}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl px-6 py-2 inline-flex items-center gap-2 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {isUploadingResume ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4" />Choose PDF</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Job Alerts */}
          <div className="relative overflow-hidden rounded-3xl bg-[#1a1a24] border-0 shadow-2xl group">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 p-5 md:p-8 flex flex-col gap-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-purple-500/10 rounded-2xl shrink-0">
                    <BellRing className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-white">Daily Job Alerts</h2>
                      {jobAlertsEnabled && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#888899] mt-0.5">
                      Get up to 10 matched jobs in your inbox every morning
                    </p>
                  </div>
                </div>

                <div className="shrink-0 mt-1">
                  {isSavingAlerts ? (
                    <div className="flex h-6 w-11 items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                    </div>
                  ) : (
                    <button
                      role="switch"
                      aria-checked={jobAlertsEnabled}
                      aria-label="Toggle daily job alerts"
                      onClick={() => void handleToggleAlerts()}
                      disabled={isToggleDisabled}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a24]',
                        jobAlertsEnabled ? 'bg-indigo-500' : 'bg-[#2a2a35]',
                        isToggleDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
                          jobAlertsEnabled ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  )}
                </div>
              </div>

              {showAlertHint && (
                <p className="text-xs text-[#666677] leading-relaxed">
                  Upload a resume and set job preferences to enable alerts
                </p>
              )}

              <div className="flex flex-col gap-3 pt-4 border-t border-[#2a2a35]">
                <div className="flex items-center gap-3 p-3 bg-[#0d0d12]/50 rounded-xl">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm text-[#aaaacc]">Email notifications</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[#0d0d12]/50 rounded-xl">
                  <MapPin className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-[#aaaacc]">Location-based alerts</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[#0d0d12]/50 rounded-xl">
                  <DollarSign className="w-4 h-4 text-pink-400" />
                  <span className="text-sm text-[#aaaacc]">Salary range matches</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Job Preferences */}
        <div className="relative overflow-hidden rounded-3xl bg-[#1a1a24] border-0 shadow-2xl group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 p-5 md:p-8 flex flex-col gap-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 pb-4 border-b border-[#2a2a35]">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl shrink-0">
                  <Briefcase className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Job Preferences</h2>
                  <p className="text-sm text-[#888899] mt-0.5">
                    Optional filters for how NextRole AI should personalize recommendations.
                  </p>
                </div>
              </div>
              <p className="text-sm text-[#66667a] sm:shrink-0">
                {totalPreferencesSelected > 0
                  ? `${totalPreferencesSelected} preference${totalPreferencesSelected === 1 ? '' : 's'} selected`
                  : 'Leave blank if you are open to all roles'}
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <div className="mb-4">
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    Target Experience Level
                  </p>
                  <p className="mt-1 text-sm text-[#888899]">Pick any that fit your current search.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {LEVEL_OPTIONS.map((level) => {
                    const checked = targetLevels.includes(level);
                    return (
                      <label
                        key={level}
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200',
                          !isSavingPrefs && 'hover:scale-[1.02]',
                          checked
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-[#2a2a35] bg-[#0d0d12]/50',
                          !checked && !isSavingPrefs && 'hover:border-[#3a3a45]',
                          isSavingPrefs ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLevel(level)}
                          disabled={isSavingPrefs}
                          className="h-4 w-4 rounded border-[#404055] bg-[#0d0d12] accent-indigo-500"
                        />
                        <span className="text-sm font-medium text-[#f0f0fa]">{level}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-4">
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                    Target Roles
                  </p>
                  <p className="mt-1 text-sm text-[#888899]">Choose the types of roles you want prioritized in chat recommendations.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {ROLE_OPTIONS.map((role) => {
                    const checked = targetRoles.includes(role);
                    return (
                      <label
                        key={role}
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200',
                          !isSavingPrefs && 'hover:scale-[1.02]',
                          checked
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-[#2a2a35] bg-[#0d0d12]/50',
                          !checked && !isSavingPrefs && 'hover:border-[#3a3a45]',
                          isSavingPrefs ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRole(role)}
                          disabled={isSavingPrefs}
                          className="h-4 w-4 rounded border-[#404055] bg-[#0d0d12] accent-indigo-500"
                        />
                        <span className="text-sm font-medium text-[#f0f0fa]">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-[#2a2a35]">
              <p className="text-sm text-[#77778a]">
                These preferences are optional and only affect personalized AI guidance.
              </p>
              <button
                onClick={() => void handleSavePreferences()}
                disabled={isSavingPrefs || !hasUnsavedPreferences}
                className="self-start sm:self-auto rounded-xl bg-indigo-500 px-5 py-2 text-sm text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingPrefs ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </span>
                ) : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
