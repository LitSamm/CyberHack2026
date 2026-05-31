# AromOS Demo-Ready Operations Design

## Goal

Turn the current hackathon dashboard into a coherent demo-ready operations system aligned with the Sima Arome problem statement: integrated records, two QC stages, traceable production lots, assisted warehouse placement, cold-chain visibility, sample dispatch, RBAC, and auditability.

## Scope

This phase deliberately targets a stable demo-ready baseline. It does not attempt a full inventory ledger, real IoT ingestion, or a complete product master.

## Workflow

```text
Material intake
-> receiving / quarantine
-> raw-material QC
-> PPIC creates lot and schedule
-> production
-> awaiting finished-product QC
-> extract / powder QC pass
-> finished-goods warehouse
-> sample dispatch or bulk dispatch
```

Raw-material QC and finished-product QC are separate release gates. PPIC may finish production, but may not release the lot to finished-goods storage. QC owns that release decision.

## Data Model

- Add `awaiting_finished_qc` to lot and schedule statuses.
- Add a minimal `material_storage_specs` table with required zone and hazard classification.
- Add current measured temperature to warehouse slots and a `cold_chain_excursions` history table.
- Extend dispatch with `movement_type`, `quantity`, and `unit`.
- Keep raw-material quarantine lightweight: store its receiving area on incoming material records.

## Atomic Domain Operations

Business mutations use Supabase RPC:

- Submit raw-material QC and update material status.
- Create lot and PPIC schedule.
- Move production schedule status while synchronizing lot status.
- Submit finished-product QC and release or reject lot.
- Assign or release warehouse slots.
- Create sample or bulk dispatch.
- Advance dispatch status, releasing a slot only when a bulk dispatch becomes shipped.

Each RPC writes an audit record in the same PostgreSQL transaction.

## Security

- Remove the hardcoded Supabase service-role credential from backend source.
- Backend loads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from environment variables.
- RLS policies use the authenticated user profile role.
- Next.js chat route requires a valid Supabase access token.
- Notification cron requires `CRON_SECRET`.

The leaked service-role key must be rotated manually in Supabase after the code change.

## UI

- `/qc` gains separate raw-material and finished-product queues.
- `/dispatch` captures sample versus bulk movement and quantity.
- `/warehouse` reads configured storage specs and exposes a small sensor simulator for demo use.
- `/lots/[id]` becomes the Digital Lot Passport, combining origin, QC, production, warehouse, cold-chain, dispatch, and audit history.

## Cleanup

Delete unused template assets and components. Move webcam diagnostics under `cv-service/scripts/diagnostics/`. Keep the OpenCV counter because it demonstrates assisted receiving, but describe it accurately as counting rather than full visual grading.

## Verification

- Run frontend domain tests.
- Run CV tests.
- Run frontend production build.
- Run lint and report any pre-existing debt that remains outside touched files.

