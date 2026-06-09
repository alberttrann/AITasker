-- =============================================================================
-- Migration 010 — Seed Data 
--
-- BEFORE PRODUCTION: cần thay cả 2 hash bằng hash mới
-- Run: node -e "require('bcrypt').hash('YOUR_NEW_STRONG_PASSWORD',12).then(console.log)"
-- Store plain-text password trong secrets manager, kh lưu ở đây
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Platform system user (no-login system account — owns fee wallet only)
-- ---------------------------------------------------------------------------
INSERT INTO users (
    id, email, password_hash, full_name, roles, active_role, is_active, created_at
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'platform@aitasker.internal',
    '$2b$12$.MI.UWpl2ZQYMqzH4iVFu.tF0FnBZiGD3DGwTeP8qQAq6amNx3w4m',
    'AITasker Platform',
    '["ADMIN"]',
    'ADMIN',
    TRUE,
    NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Platform wallet (receives all PLATFORM_FEE ledger entries)
-- ---------------------------------------------------------------------------
INSERT INTO wallets (id, user_id, available_balance, locked_balance)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 0, 0);

-- Stub WALLET_TOPUP VA — this account never scans QR to top up
INSERT INTO virtual_accounts (id, entity_type, entity_id, va_number, fixed_amount, expires_at, status)
VALUES ('00000000-0000-0000-0000-000000000003', 'WALLET_TOPUP', '00000000-0000-0000-0000-000000000001',
        'PLATFORM_TOPUP_VA', NULL, NULL, 'ACTIVE');

-- ---------------------------------------------------------------------------
-- 3. platform_settings singleton (fee = 5%; read at every APPROVED TX)
-- ---------------------------------------------------------------------------
INSERT INTO platform_settings (id, platform_wallet_id, platform_fee_pct, updated_at)
VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 0.05, NOW());

-- ---------------------------------------------------------------------------
-- 4. Admin user (dev password: Admin@AITasker2024! — ROTATE trước production)
-- ---------------------------------------------------------------------------
INSERT INTO users (
    id, email, password_hash, full_name, roles, active_role, is_active, created_at
) VALUES (
    '00000000-0000-0000-0000-000000000010',
    'admin@aitasker.dev',
    '$2b$12$FUsqZwNd2O7Gtq.wH4IiZOd5zg67vUb8JfyDNfDz2T1vJvMepuv0C',
    'AITasker Admin',
    '["ADMIN"]',
    'ADMIN',
    TRUE,
    NOW()
);

-- ---------------------------------------------------------------------------
-- 5. Admin wallet (required by wallets.user_id UNIQUE NOT NULL constraint)
-- ---------------------------------------------------------------------------
INSERT INTO wallets (id, user_id, available_balance, locked_balance)
VALUES ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000010', 0, 0);

INSERT INTO virtual_accounts (id, entity_type, entity_id, va_number, fixed_amount, expires_at, status)
VALUES ('00000000-0000-0000-0000-000000000012', 'WALLET_TOPUP', '00000000-0000-0000-0000-000000000010',
        'ADMIN_TOPUP_VA', NULL, NULL, 'ACTIVE');

-- =============================================================================
-- Verification 
-- =============================================================================
DO $$
DECLARE
  v_settings_count   INT;
  v_fee_pct          FLOAT;
  v_platform_balance BIGINT;
  v_admin_count      INT;
BEGIN
  SELECT COUNT(*)        INTO v_settings_count   FROM platform_settings;
  SELECT platform_fee_pct INTO v_fee_pct          FROM platform_settings;
  SELECT w.available_balance INTO v_platform_balance
    FROM wallets w JOIN platform_settings ps ON ps.platform_wallet_id = w.id;
  SELECT COUNT(*)        INTO v_admin_count       FROM users WHERE active_role = 'ADMIN';

  ASSERT v_settings_count   = 1,    'SEED FAIL: platform_settings must have exactly 1 row';
  ASSERT v_fee_pct          = 0.05, 'SEED FAIL: platform_fee_pct must be 0.05';
  ASSERT v_platform_balance = 0,    'SEED FAIL: platform wallet balance must be 0';
  ASSERT v_admin_count      = 2,    'SEED FAIL: must have exactly 2 ADMIN users';

  RAISE NOTICE 'SEED OK: settings=%, fee=%, platform_balance=%, admins=%',
    v_settings_count, v_fee_pct, v_platform_balance, v_admin_count;
END;
$$;