-- Add 'qloapps' to the valid pms_type CHECK constraint

ALTER TABLE pms_configurations
  DROP CONSTRAINT pms_configurations_pms_type_check,
  ADD CONSTRAINT pms_configurations_pms_type_check
    CHECK (pms_type IN ('cloudbeds', 'mews', 'qloapps', 'custom'));
