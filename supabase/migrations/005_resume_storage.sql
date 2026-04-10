-- Migration 005: Create resume storage bucket and policies

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can upload own resume'
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload own resume"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'resumes' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can read own resume'
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can read own resume"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'resumes' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can delete own resume'
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete own resume"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'resumes' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can update own resume'
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can update own resume"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'resumes' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;