-- Keep existing databases aligned with the shared patient status contract.
ALTER TYPE shared.patient_status ADD VALUE IF NOT EXISTS 'merged';
