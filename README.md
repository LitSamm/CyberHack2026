# AromOS — Integrated Operations System
### by Sima Arome Indonesia 🌿

AromOS adalah sistem manajemen operasi terintegrasi untuk Sima Arome, produsen ekstrak alam Indonesia. Aplikasi ini mengelola seluruh rantai produksi: penerimaan bahan baku → QC → penjadwalan PPIC → tracking lot → pemetaan gudang → pengiriman sampel.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + Custom CSS |
| UI Library | Radix UI primitives + custom components |
| Charts | Recharts |
| Drag & Drop | Native HTML5 DnD (Kanban) |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| ML | Python + OpenCV |
| Auth | Supabase Auth + JWT |
| Deploy | Vercel (frontend) + Railway (backend) |

---

## 📋 Prasyarat

- Node.js 18+ 
- npm 9+
- Akun Supabase (gratis) — https://supabase.com

---

## 🛠️ Setup Instructions

### 1. Clone & Install

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

# Install AI camera receiving service dependencies
cd ../cv-service
python -m pip install -r requirements.txt
```

### 2. Setup Supabase

1. Buat proyek baru di https://supabase.com
2. Buka **SQL Editor** di dashboard Supabase
3. Jalankan SQL berikut secara berurutan:
   - `supabase/schema.sql`
   - `supabase/material_qc_migration.sql`
   - `supabase/notifications_schema.sql`
   - `supabase/demo_ready_operations_migration.sql`
   - `supabase/powder_screening_ai_migration.sql`
4. Catat:
   - Project URL: `https://xxx.supabase.co`
   - Anon Key (dari Settings → API)
   - Service Role Key (dari Settings → API)

### 3. Environment Variables

**Frontend** — buat file `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_CV_SERVICE_URL=http://localhost:8000
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-untuk-ai-assistant
CRON_SECRET=replace-with-a-long-random-secret
```

**Backend** — buat file `backend/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
CRON_SECRET=replace-with-the-same-long-random-secret
```

> Security note: never commit a Supabase service-role key. If a key has ever been committed, rotate it from the Supabase dashboard before running the application.

### 4. Seed Data

```bash
cd backend
npm run seed
```

Ini akan membuat:
- 12 user (3 per role)
- 10 supplier Indonesia
- 20 incoming materials
- 15 lots dalam berbagai status
- 30 warehouse slots
- 10 dispatch records

### 5. Jalankan Aplikasi

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev

# Terminal 3 — AI Camera Receiving Service
cd cv-service
python cv_server.py
```

Buka http://localhost:3000

### 6. Alur Demo Utama

```text
Material intake
→ quarantine receiving
→ raw-material QC
→ PPIC membuat lot dan menjalankan produksi
→ awaiting finished-product QC
→ extract / powder release QC
→ warehouse slot + cold-chain sensor simulator
→ sample dispatch atau bulk dispatch
```

- Sample dispatch mencatat pergerakan sampel tanpa mengosongkan slot lot.
- Bulk dispatch melepas slot ketika status berubah menjadi `shipped`.
- Klik nomor lot pada dashboard admin untuk membuka Digital Lot Passport.

---

## 🔑 Akun Demo

| Role | Email | Password |
|------|-------|----------|
| Admin | budi.admin@simaarome.id | Admin@123 |
| QC Officer | siti.qc@simaarome.id | Qc@12345 |
| PPIC | fajar.ppic@simaarome.id | Ppic@123 |
| Warehouse | teguh.wh@simaarome.id | Wh@12345 |

---

## 📡 API dan RPC

Mutasi operasional berjalan melalui Supabase RPC agar perubahan status, audit trail, dan validasi role diproses atomik di database. Backend Express hanya menangani kebutuhan administratif yang masih memerlukan service-role key.

### Auth
```
POST   /api/auth/login         Login dengan email + password
POST   /api/auth/logout        Logout
POST   /api/auth/refresh       Refresh access token
```

### Users (Admin only)
```
GET    /api/users              List semua user
POST   /api/users              Buat user baru
PUT    /api/users/:id          Update user
DELETE /api/users/:id          Deactivate user
```

### Audit Trail (Admin only)
```
GET    /api/audit-logs         List log (?user_id, ?action, ?table_name, ?from, ?to)
GET    /api/audit-logs/export  Export CSV
```

### Mutasi Operasional (Supabase RPC)
```
receive_material
submit_raw_material_qc
create_ppic_schedule
move_ppic_schedule
submit_finished_product_qc
assign_warehouse_slot
release_warehouse_slot
create_dispatch
advance_dispatch
record_sensor_reading
```

---

## 🏗️ Struktur Proyek

```
aromOS/
├── frontend/                    ← Next.js 16 App
│   └── src/
│       ├── app/
│       │   ├── login/page.tsx   ← Login page
│       │   ├── admin/           ← Admin dashboard
│       │   ├── ai-assistant/    ← AI Chat Assistant (Gemini)
│       │   ├── qc/              ← QC dashboard
│       │   ├── ppic/            ← PPIC + Kanban
│       │   ├── warehouse/       ← Floor map
│       │   └── dispatch/        ← Pengiriman
│       ├── components/
│       │   ├── layout/          ← Sidebar, TopBar, DashboardLayout
│       │   └── ui/              ← StatCard, StatusBadge, ConfirmModal
│       ├── contexts/            ← AuthContext
│       └── lib/                 ← api.ts, supabase.ts, utils.ts
├── backend/                     ← Express API
│   └── src/
│       ├── routes/              ← Semua endpoint
│       ├── middleware/          ← auth.js, audit.js
│       └── db/                  ← supabase.js, seed.js
├── supabase/
│   └── schema.sql               ← Database schema lengkap
├── ml/
│   └── apple_counter/           ← OpenCV apple conveyor counter
└── README.md
```

ML apple counter sementara ada di `ml/apple_counter/`. Lihat `ml/apple_counter/README.md` untuk setup, test, dan command generate video annotated.

---

## 🌐 Deployment

### Frontend → Vercel
1. Push ke GitHub
2. Import di vercel.com
3. Set environment variables (NEXT_PUBLIC_*)
4. Deploy

### Backend → Railway
1. Push backend folder ke GitHub
2. New Project di railway.app → Deploy from GitHub
3. Set environment variables
4. Get public URL → update NEXT_PUBLIC_API_URL di Vercel

---

## 📄 License

© 2024 Sima Arome Indonesia. All rights reserved.
