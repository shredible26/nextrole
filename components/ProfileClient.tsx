'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Briefcase, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react';
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

export interface ProfileClientProps {
  userId: string;
  email: string;
  displayName: string | null;
  tier: 'free' | 'pro';
  subscriptionStatus: string | null;
  applicationCount: number;
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

function formatSubscriptionStatus(status: string | null) {
  if (!status) {
    return null;
  }

  return status
    .split('_')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function getSubscriptionStatusClass(status: string | null) {
  switch (status) {
    case 'active':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'past_due':
      return 'text-amber-600 dark:text-amber-400';
    case 'canceled':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
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

export default function ProfileClient({
  userId,
  email,
  displayName,
  tier,
  subscriptionStatus,
  applicationCount,
}: ProfileClientProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentDisplayName, setCurrentDisplayName] = useState(displayName);
  const [draftDisplayName, setDraftDisplayName] = useState(displayName ?? '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [resume, setResume] = useState<ResumeInfo | null>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isDeletingResume, setIsDeletingResume] = useState(false);
  const [targetLevels, setTargetLevels] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);
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
    let active = true;

    async function loadPrefs() {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('target_levels, target_roles')
        .eq('id', userId)
        .maybeSingle();

      if (!active) return;

      if (data) {
        if (Array.isArray(data.target_levels)) setTargetLevels(data.target_levels as string[]);
        if (Array.isArray(data.target_roles)) setTargetRoles(data.target_roles as string[]);
      }
      setIsLoadingPrefs(false);
    }

    void loadPrefs();

    return () => {
      active = false;
    };
  }, [userId]);

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

  function toggleLevel(level: string) {
    setTargetLevels(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
  }

  function toggleRole(role: string) {
    setTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
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
  const formattedSubscriptionStatus = formatSubscriptionStatus(subscriptionStatus);
  const canSaveName =
    !isSavingName &&
    draftDisplayName.trim().length >= 1 &&
    draftDisplayName.trim().length <= 50;

  return (
    <div className="min-h-screen bg-[#0d0d12] py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">

        {/* Card 1 — Profile identity */}
        <div className="relative bg-[#1a1a24] border border-[#2a2a35] rounded-2xl p-6 flex items-center gap-5">
          <button
            onClick={() => window.history.back()}
            aria-label="Go back"
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-[#2a2a35] hover:bg-[#3a3a45] flex items-center justify-center text-[#888899] hover:text-[#f0f0fa] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
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
        </div>

        {/* Card 2 — Applications */}
        <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-2xl p-6 flex flex-col gap-4">
          <div className="bg-[#0d0d12] rounded-xl p-4 flex items-center gap-3">
            <div className="bg-indigo-500/20 rounded-full h-10 w-10 flex items-center justify-center shrink-0">
              <Briefcase className="text-indigo-400 h-5 w-5" />
            </div>
            <div>
              <p className="text-[#888899] text-sm">Applications</p>
              <p className="text-[#f0f0fa] text-lg font-semibold">{applicationCount} jobs applied</p>
            </div>
          </div>
        </div>

        {/* Card 3 — Plan */}
        <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-2xl p-6 flex items-center justify-between">
          <div>
            <p className="text-[#888899] text-sm mb-1">Current plan</p>
            {tier === 'pro' ? (
              <span className="bg-emerald-500 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">Pro</span>
            ) : (
              <span className="bg-[#2a2a35] text-[#aaaacc] text-xs px-2.5 py-0.5 rounded-full font-medium">Free</span>
            )}
          </div>
          {tier === 'free' ? (
            <Link href="/pricing" className="text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-400 transition-colors px-4 py-2 rounded-full">
              Upgrade to Pro →
            </Link>
          ) : (
            <p className={cn('text-sm font-medium', getSubscriptionStatusClass(subscriptionStatus))}>
              {formattedSubscriptionStatus ? `Status: ${formattedSubscriptionStatus}` : 'Status unavailable'}
            </p>
          )}
        </div>

        {/* Card 4 — Resume */}
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

        {/* Card 5 — Job Preferences */}
        <div className="bg-[#1a1a24] border border-[#2a2a35] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[#f0f0fa] text-lg font-semibold">Job Preferences</h2>
            <p className="text-[#888899] text-sm">Personalizes your AI recommendations.</p>
          </div>

          {isLoadingPrefs ? (
            <div className="flex items-center gap-2 text-[#555566] text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[#aaaacc] text-sm font-medium mb-3">Target Experience Level</p>
                <div className="flex flex-wrap gap-2">
                  {LEVEL_OPTIONS.map(level => {
                    const checked = targetLevels.includes(level);
                    return (
                      <button
                        key={level}
                        onClick={() => toggleLevel(level)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          checked
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                            : 'bg-transparent border-[#2a2a35] text-[#888899] hover:border-[#3a3a45] hover:text-[#aaaacc]'
                        }`}
                      >
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[#aaaacc] text-sm font-medium mb-3">Target Roles</p>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map(role => {
                    const checked = targetRoles.includes(role);
                    return (
                      <button
                        key={role}
                        onClick={() => toggleRole(role)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          checked
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                            : 'bg-transparent border-[#2a2a35] text-[#888899] hover:border-[#3a3a45] hover:text-[#aaaacc]'
                        }`}
                      >
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => void handleSavePreferences()}
                disabled={isSavingPrefs}
                className="self-start bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-colors"
              >
                {isSavingPrefs ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </span>
                ) : 'Save Preferences'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
