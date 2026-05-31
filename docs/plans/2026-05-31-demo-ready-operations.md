# AromOS Demo-Ready Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a secure, traceable demo-ready Sima Arome workflow with two QC gates, atomic Supabase mutations, sample-aware dispatch, cold-chain visibility, and a Digital Lot Passport.

**Architecture:** PostgreSQL RPC functions own multi-table domain mutations and audit writes. The frontend calls those RPC functions through the existing Supabase client. Express remains for admin-only utilities, while server-side Next.js endpoints are protected before using service-role credentials.

**Tech Stack:** Supabase PostgreSQL, Next.js App Router, TypeScript, Express, Node test runner, Python pytest.

---

### Task 1: Database migration and RPC contract

**Files:**
- Create: `supabase/demo_ready_operations_migration.sql`
- Test: `frontend/src/lib/workflowDomain.test.js`

1. Add a failing domain test for the finished-product QC stage and sample dispatch semantics.
2. Extend the workflow domain helper until the test passes.
3. Add schema changes, RLS helpers, policies, and RPC functions.
4. Document the one-time migration command.

### Task 2: Secure server credentials and privileged routes

**Files:**
- Modify: `backend/src/db/supabase.js`
- Modify: `frontend/src/app/api/chat/route.ts`
- Modify: `frontend/src/app/api/cron/notifications/route.ts`
- Modify: `backend/.env.example`

1. Remove hardcoded credentials.
2. Validate authenticated chat requests.
3. Require `CRON_SECRET` for cron execution.
4. Document required environment variables and service-key rotation.

### Task 3: Frontend RPC integration and dual QC

**Files:**
- Modify: `frontend/src/lib/supabase-api.ts`
- Modify: `frontend/src/app/qc/page.tsx`
- Modify: `frontend/src/app/ppic/page.tsx`

1. Add typed RPC wrappers.
2. Submit raw-material QC through RPC.
3. Add the finished-product QC queue and lot-level submission.
4. Route PPIC status changes and schedule creation through RPC.

### Task 4: Warehouse and dispatch semantics

**Files:**
- Modify: `frontend/src/lib/supabase-api.ts`
- Modify: `frontend/src/app/warehouse/page.tsx`
- Modify: `frontend/src/app/dispatch/page.tsx`

1. Read configured storage specs instead of material-name heuristics.
2. Use RPC for slot assignment and release.
3. Add a sensor simulation action and excursion display.
4. Capture sample or bulk dispatch quantity and advance status through RPC.

### Task 5: Digital Lot Passport

**Files:**
- Create: `frontend/src/app/lots/[id]/page.tsx`
- Modify: `frontend/src/lib/supabase-api.ts`
- Modify: `frontend/src/app/admin/page.tsx`

1. Add a joined lot detail query.
2. Render origin, QC, PPIC, storage, temperature excursions, dispatches, and audit history.
3. Link lot numbers from the admin dashboard to the passport.

### Task 6: Cleanup and verification

**Files:**
- Delete unused frontend template files and assets.
- Move: `cv-service/test_cam.py`
- Move: `cv-service/test_frame.py`
- Modify: `README.md`

1. Remove verified dead code.
2. Move manual camera diagnostics.
3. Update setup and demo instructions.
4. Run tests, build, and lint.

