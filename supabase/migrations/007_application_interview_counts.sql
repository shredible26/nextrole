-- Migration 007: Track cumulative interview counts per application

ALTER TABLE applications
  ADD COLUMN interview_count INT NOT NULL DEFAULT 0;

ALTER TABLE applications
  ADD CONSTRAINT applications_interview_count_nonnegative
  CHECK (interview_count >= 0);

UPDATE applications
SET interview_count = CASE
  WHEN status IN ('phone_screen', 'interview', 'offer') THEN 1
  ELSE 0
END
WHERE interview_count = 0;
