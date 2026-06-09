-- =============================================================================
-- Migration 002 — Finance: Wallets · Transactions · Virtual Accounts ·
--                          Withdrawal Requests · Platform Settings
-- Depends on: 001_identity (users)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- wallets
-- ---------------------------------------------------------------------------
CREATE TABLE wallets (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID    NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    available_balance   BIGINT  NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    locked_balance      BIGINT  NOT NULL DEFAULT 0 CHECK (locked_balance >= 0)
);

CREATE INDEX idx_wallets_user_id ON wallets (user_id);

-- ---------------------------------------------------------------------------
-- wallet_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE wallet_transactions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id           UUID        NOT NULL REFERENCES wallets (id),
    amount              BIGINT      NOT NULL CHECK (amount > 0),
    transaction_type    TEXT        NOT NULL CHECK (transaction_type IN (
                            'TOP_UP',
                            'SUBSCRIPTION',
                            'ESCROW_LOCK',
                            'ESCROW_RELEASE',
                            'PLATFORM_FEE',
                            'ESCROW_REFUND',
                            'ESCROW_SPLIT',
                            'WITHDRAWAL'
                        )),
    reference_id        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX wallet_tx_idempotency
    ON wallet_transactions (wallet_id, reference_id)
    WHERE reference_id IS NOT NULL;

CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions (wallet_id);
CREATE INDEX idx_wallet_transactions_type      ON wallet_transactions (transaction_type);
CREATE INDEX idx_wallet_transactions_created   ON wallet_transactions (created_at DESC);

-- ---------------------------------------------------------------------------
-- virtual_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE virtual_accounts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     TEXT        NOT NULL CHECK (entity_type IN ('WALLET_TOPUP', 'MILESTONE', 'SERVICE')),
    entity_id       TEXT        NOT NULL,
    va_number       TEXT        NOT NULL UNIQUE,
    fixed_amount    BIGINT,     -- NULL for WALLET_TOPUP; set for MILESTONE/SERVICE
    expires_at      TIMESTAMPTZ,-- NULL for WALLET_TOPUP; +24h for MILESTONE/SERVICE
    status          TEXT        NOT NULL DEFAULT 'ACTIVE'
                                    CHECK (status IN ('ACTIVE', 'EXPIRED', 'USED'))
);

CREATE INDEX idx_virtual_accounts_entity ON virtual_accounts (entity_type, entity_id);
CREATE INDEX idx_virtual_accounts_status ON virtual_accounts (status);

-- ---------------------------------------------------------------------------
-- withdrawal_requests
-- ---------------------------------------------------------------------------
CREATE TABLE withdrawal_requests (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id           UUID        NOT NULL REFERENCES users (id),
    type                TEXT        NOT NULL CHECK (type IN ('MILESTONE_RELEASE', 'EXPERT_MANUAL')),
    amount              BIGINT      NOT NULL CHECK (amount > 0),
    bank_account_xid    TEXT        NOT NULL,
    disbursement_id     TEXT,
    status              TEXT        NOT NULL DEFAULT 'PENDING'
                                        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at        TIMESTAMPTZ
);

CREATE INDEX idx_withdrawal_requests_expert_id ON withdrawal_requests (expert_id);
CREATE INDEX idx_withdrawal_requests_status    ON withdrawal_requests (status);

-- ---------------------------------------------------------------------------
-- platform_settings
-- ---------------------------------------------------------------------------
CREATE TABLE platform_settings (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_wallet_id  UUID        UNIQUE REFERENCES wallets (id),
    platform_fee_pct    FLOAT       NOT NULL DEFAULT 0.05,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);