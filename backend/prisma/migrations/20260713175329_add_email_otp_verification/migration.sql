-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_otp" TEXT,
ADD COLUMN     "email_otp_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "is_email_verified" BOOLEAN NOT NULL DEFAULT false;
