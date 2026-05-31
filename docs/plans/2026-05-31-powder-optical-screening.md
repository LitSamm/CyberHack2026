# Powder Optical Screening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OpenCV-assisted finished-product QC with upload, webcam snapshot, and optional HOSI CSV input.

**Architecture:** Implement a deterministic OpenCV analyzer inside the existing FastAPI CV service. Feed its recommendations into the editable finished-product QC form and persist AI metadata separately from the operator decision through Supabase RPC.

**Tech Stack:** Python, OpenCV, FastAPI, Next.js, TypeScript, Supabase PostgreSQL RPC

---

### Task 1: OpenCV powder analyzer

**Files:**
- Create: `cv-service/powder_screening.py`
- Create: `cv-service/test_powder_screening.py`

Write synthetic-image tests, implement color grading, consistency grading, visual outlier detection, confidence scoring, and annotated JPEG preview generation.

### Task 2: CV service endpoints

**Files:**
- Modify: `cv-service/cv_server.py`
- Modify: `cv-service/requirements.txt`

Add multipart upload, webcam snapshot analysis, and HOSI CSV summary endpoints with validation.

### Task 3: Persist AI recommendations

**Files:**
- Modify: `supabase/demo_ready_operations_migration.sql`
- Modify: `frontend/src/lib/supabase-api.ts`

Extend the finished-product QC RPC with optional AI metadata and store it in the existing `qc_checks.ai_*` columns.

### Task 4: QC frontend integration

**Files:**
- Modify: `frontend/src/app/qc/page.tsx`

Add an AI-assisted screening panel to the finished-product QC modal. Support file upload, webcam snapshot, optional HOSI CSV summary, editable recommendations, preview rendering, and fallback to manual QC.

### Task 5: Verification

Run:

```bash
python -m pytest cv-service/test_powder_screening.py cv-service/test_receiving_session.py ml/apple_counter/tests -q
cd frontend && npm run lint && npm run build
git diff --check
```

