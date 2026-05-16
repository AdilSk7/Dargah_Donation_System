-- ============================================================
--  Dargah Donation Management — MySQL Schema
--  Run this once to set up the database
-- ============================================================

CREATE DATABASE IF NOT EXISTS dargah_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dargah_db;

-- Members table
CREATE TABLE IF NOT EXISTS members (
    id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
    name        VARCHAR(120)  NOT NULL,
    mobile      VARCHAR(15)   NOT NULL UNIQUE,
    address     TEXT,
    upi_id      VARCHAR(100),
    password    VARCHAR(200)  NOT NULL,
    role        VARCHAR(10)   NOT NULL DEFAULT 'member',
    join_date   DATE          NOT NULL DEFAULT (CURDATE()),
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mobile (mobile),
    INDEX idx_role   (role)
) ENGINE=InnoDB;

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id           VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    member_id    VARCHAR(36)  NOT NULL,
    month        VARCHAR(7)   NOT NULL,    -- YYYY-MM
    amount       INT          NOT NULL DEFAULT 100,
    status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
    utr          VARCHAR(50),
    note         TEXT,
    screenshot   VARCHAR(200),
    submitted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at  DATETIME,
    verified_by  VARCHAR(36),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    UNIQUE KEY unique_member_month (member_id, month),
    INDEX idx_status (status),
    INDEX idx_month  (month)
) ENGINE=InnoDB;

-- ── Seed admin user (password: admin123) ─────────────────────────────────────
-- The Flask app seeds this automatically on first run.
-- Manual insert if needed:
-- INSERT INTO members (id, name, mobile, address, password, role)
-- VALUES (UUID(), 'Admin', '9001447689', 'Dargah Office',
--         '$2b$12$...bcrypt_hash_of_admin123...', 'admin');

-- ── Useful views ─────────────────────────────────────────────────────────────

-- Monthly collection summary
CREATE OR REPLACE VIEW monthly_summary AS
SELECT
    month,
    COUNT(CASE WHEN status = 'verified' THEN 1 END)  AS paid_count,
    COUNT(CASE WHEN status = 'pending'  THEN 1 END)  AS pending_count,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END)  AS rejected_count,
    SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) AS total_collected
FROM payments
GROUP BY month
ORDER BY month DESC;

-- Member dues view
CREATE OR REPLACE VIEW member_dues AS
SELECT
    m.id, m.name, m.mobile, m.address, m.join_date,
    COALESCE(SUM(CASE WHEN p.status='verified' THEN p.amount END), 0) AS total_paid,
    COUNT(CASE WHEN p.status='pending' THEN 1 END) AS pending_payments
FROM members m
LEFT JOIN payments p ON p.member_id = m.id
WHERE m.role = 'member'
GROUP BY m.id;

SHOW TABLES;
SELECT 'Schema setup complete ✅' AS status;
