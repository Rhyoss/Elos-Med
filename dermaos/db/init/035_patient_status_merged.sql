-- Add 'merged' to patient_status enum (used by patient dedup/merge flow)
ALTER TYPE shared.patient_status ADD VALUE IF NOT EXISTS 'merged';
