'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Briefcase, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
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

  return (
    <div className="w-full bg-[#0d0d12] px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">

        {/* Card 1 — Profile identity */}
        <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-2xl p-6 flex items-start gap-5">
          <div className="h-16 w-16 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex flex-col gap-3">
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
                  className="bg-[#0d0d12] border-[#2a2a35] text-[#f0f0fa] placeholder:text-[#555566] rounded-lg"
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
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold text-[#f0f0fa]">{displayNameLabel}</span>
                  <button
                    onClick={handleStartEditing}
                    aria-label="Edit display name"
                    className="text-[#555566] hover:text-[#aaaacc] transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-[#888899] mt-1">{email}</p>
              </>
            )}
          </div>
          <div className="shrink-0 self-start">
            {tier === 'pro' ? (
              <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                Pro
              </span>
            ) : (
              <Link href="/pricing" className="inline-flex rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-400">
                Upgrade to Pro →
              </Link>
            )}
          </div>
        </div>

        {/* Card 2 — Applications */}
        <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 rounded-full h-10 w-10 flex items-center justify-center shrink-0">
              <Briefcase className="text-indigo-400 h-5 w-5" />
            </div>
            <div>
              <p className="text-[#888899] text-sm">Applications</p>
              <p className="text-[#f0f0fa] text-lg font-semibold">{applicationCount} jobs applied</p>
            </div>
          </div>
        </div>

        {/* Card 3 — Resume */}
        <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#f0f0fa] text-lg font-semibold">Resume</h2>
            <p className="text-[#888899] text-sm">Upload a PDF up to 5MB.</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={handleResumeSelected}
          />

          {isLoadingResume ? (
            <div className="border border-dashed border-[#2a2a35] rounded-xl p-8 text-center mt-4">
              <Loader2 className="text-[#555566] h-5 w-5 animate-spin mx-auto mb-2" />
              <p className="text-[#555566] text-sm">Checking for an existing resume...</p>
            </div>
          ) : resume ? (
            <div className="bg-[#0d0d12] rounded-xl border border-[#2a2a35] p-4 mt-4">
              <p className="text-[#f0f0fa] font-medium">{resume.name}</p>
              <p className="text-[#888899] text-sm mt-0.5">Uploaded {formatUploadDate(resume.uploadedAt)}</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingResume || isDeletingResume}
                  className="border border-[#2a2a35] bg-transparent text-[#f0f0fa] hover:bg-[#2a2a35] rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
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
                  className="bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 rounded-lg px-3 py-1.5 text-sm inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
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
            <div className="border border-dashed border-[#2a2a35] rounded-xl p-8 text-center mt-4">
              <Upload className="text-[#444455] h-8 w-8 mx-auto mb-3" />
              <p className="text-[#f0f0fa] font-medium">Upload your resume</p>
              <p className="text-[#888899] text-sm mt-1">Keep one current copy ready for applications.</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingResume || isDeletingResume}
                className="bg-indigo-500 hover:bg-indigo-400 text-white rounded-full px-6 py-2 mt-4 inline-flex items-center gap-2 transition-colors disabled:opacity-50"
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

        {/* Card 4 — Job Preferences */}
        <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-2xl p-6">
          <div className="flex flex-col gap-2 border-b border-[#2a2a35] pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[#f0f0fa] text-lg font-semibold">Job Preferences</h2>
              <p className="mt-1 text-sm text-[#888899]">
                Optional filters for how NextRole AI should personalize recommendations.
              </p>
            </div>
            <p className="text-sm text-[#66667a]">
              {totalPreferencesSelected > 0
                ? `${totalPreferencesSelected} preference${totalPreferencesSelected === 1 ? '' : 's'} selected`
                : 'Leave blank if you are open to all roles'}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-6">
            <div>
              <div className="mb-4">
                <p className="text-sm font-medium text-[#f0f0fa]">Target Experience Level</p>
                <p className="mt-1 text-sm text-[#888899]">
                  Pick any that fit your current search.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {LEVEL_OPTIONS.map((level) => {
                  const checked = targetLevels.includes(level);

                  return (
                    <label
                      key={level}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                        checked
                          ? 'border-indigo-500/45 bg-indigo-500/10'
                          : 'border-[#2a2a35] bg-[#151520] hover:border-[#3a3a45] hover:bg-[#181824]',
                        isSavingPrefs ? 'opacity-75' : 'cursor-pointer'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLevel(level)}
                        disabled={isSavingPrefs}
                        className="mt-0.5 h-4 w-4 rounded border-[#404055] bg-[#0d0d12] accent-indigo-500"
                      />
                      <span className="text-sm font-medium text-[#f0f0fa]">{level}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-4">
                <p className="text-sm font-medium text-[#f0f0fa]">Target Roles</p>
                <p className="mt-1 text-sm text-[#888899]">
                  Choose the types of roles you want prioritized in chat recommendations.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ROLE_OPTIONS.map((role) => {
                  const checked = targetRoles.includes(role);

                  return (
                    <label
                      key={role}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                        checked
                          ? 'border-indigo-500/45 bg-indigo-500/10'
                          : 'border-[#2a2a35] bg-[#151520] hover:border-[#3a3a45] hover:bg-[#181824]',
                        isSavingPrefs ? 'opacity-75' : 'cursor-pointer'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(role)}
                        disabled={isSavingPrefs}
                        className="mt-0.5 h-4 w-4 rounded border-[#404055] bg-[#0d0d12] accent-indigo-500"
                      />
                      <span className="text-sm font-medium text-[#f0f0fa]">{role}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#2a2a35] pt-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#77778a]">
                These preferences are optional and only affect personalized AI guidance.
              </p>
              <button
                onClick={() => void handleSavePreferences()}
                disabled={isSavingPrefs || !hasUnsavedPreferences}
                className="self-start rounded-lg bg-indigo-500 px-5 py-2 text-sm text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
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
