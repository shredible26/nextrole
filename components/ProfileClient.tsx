'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Briefcase, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

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

      await refreshResume();
      toast.success('Resume uploaded successfully');
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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
            {initials}
          </div>

          <div className="w-full">
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
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void handleSaveName()} disabled={!canSaveName}>
                    {isSavingName ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelEditing}
                    disabled={isSavingName}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">{displayNameLabel}</h1>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleStartEditing}
                  aria-label="Edit display name"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}

            <p className="mt-1 text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Applications</p>
              <p className="text-lg font-semibold">{applicationCount} jobs applied</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current plan</span>
              {tier === 'pro' ? (
                <Badge className="bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-600">
                  Pro
                </Badge>
              ) : (
                <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                  Free
                </Badge>
              )}
            </div>

            {tier === 'free' ? (
              <Link
                href="/pricing"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Upgrade to Pro →
              </Link>
            ) : (
              <p className={cn('text-sm font-medium', getSubscriptionStatusClass(subscriptionStatus))}>
                {formattedSubscriptionStatus ? `Status: ${formattedSubscriptionStatus}` : 'Status unavailable'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Resume</h2>
            <p className="text-sm text-muted-foreground">Upload a PDF up to 5MB.</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={handleResumeSelected}
        />

        <div className="mt-4">
          {isLoadingResume ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for an existing resume...
            </div>
          ) : resume ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{resume.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Uploaded {formatUploadDate(resume.uploadedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingResume || isDeletingResume}
                  >
                    {isUploadingResume ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Replace'
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDeleteResume()}
                    disabled={isUploadingResume || isDeletingResume}
                  >
                    {isDeletingResume ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="font-medium">Upload your resume (PDF only)</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep one current copy ready for applications.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingResume || isDeletingResume}
              >
                {isUploadingResume ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Choose PDF
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
