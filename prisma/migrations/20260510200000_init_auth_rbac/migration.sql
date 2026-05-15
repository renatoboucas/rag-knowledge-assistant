CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "clerk_id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "image_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "clerk_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "image_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "memberships" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "organization_id" TEXT NOT NULL,
  "clerk_invitation_id" TEXT,
  "clerk_role" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "invited_email" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");

CREATE UNIQUE INDEX "organizations_clerk_id_key" ON "organizations"("clerk_id");
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

CREATE UNIQUE INDEX "memberships_clerk_invitation_id_key" ON "memberships"("clerk_invitation_id");
CREATE UNIQUE INDEX "memberships_user_id_organization_id_key" ON "memberships"("user_id", "organization_id");
CREATE INDEX "memberships_organization_id_role_idx" ON "memberships"("organization_id", "role");
CREATE INDEX "memberships_invited_email_idx" ON "memberships"("invited_email");

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
