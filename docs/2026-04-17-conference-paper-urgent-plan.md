# Urgent Plan: Abstract Deadline + Camera-Ready (Revisi 2026-04-23)

## Konteks

Target utama sekarang: **abstrak + short paper submission minggu ini**.
Dokumen ini merangkum kondisi proyek terbaru (per 2026-04-23) dan memetakan jalur tercepat menuju submit, dengan metodologi yang **mudah dijalankan** dan **sesuai dengan kondisi aplikasi** (bukan eksperimen akademik baru dari nol).

## 0. Snapshot Kondisi Proyek (Wajib Baca Sebelum Menulis)

Berikut status fitur hasil update `docs/plan.md` dan dokumen phase-4 terbaru:

### Fitur sudah selesai dan verified

- **Phase 0-3** selesai (multi-tenant, auth, RLS, WAHA session, message templates).
- **Phase 4 core reliability** selesai:
  - Webhook PMS ingestion + dedupe/idempotency (`lib/automation/idempotency.ts`).
  - Status trigger engine + template renderer (`lib/automation/status-trigger.ts`).
  - Queue, retry backoff, dead-letter (`lib/automation/queue.ts`, `retry-policy.ts`).
  - Scheduler cron (`app/api/cron/automation/route.ts`, `lib/automation/scheduler.ts`).
  - PMS auto-sync (`lib/pms/auto-sync-service.ts`, `pms-sync-cron.ts`).
- **Phase 4.4 Post-stay AI Follow-up** selesai:
  - Hybrid web-form + AI WhatsApp follow-up.
  - Auto-escalation 24 jam (`pending` -> `ai_followup`) via `feedback-escalation.ts`.
  - Tenant AI settings (`ai_settings` table + `/settings/ai`) menginjeksi prompt.
  - Reward loyalty +50 poin idempotent via RPC `complete_post_stay_feedback_with_reward`.
  - Deterministic handoff pada error provider retryable (429).
- **Phase 4.5 Lifecycle Agentic AI** selesai baseline:
  - Pre-arrival, on-stay, post-stay agents + lifecycle session persistence (`lifecycle_ai_sessions`).
  - Tools: `capture_arrival_eta`, `request_early_checkin`, `order_in_room_dining`, `request_housekeeping`, `update_guest_feedback`, `escalate_to_human`.
  - Language routing berbasis nomor telepon (`08`/`+62`/`62` -> ID, lainnya -> EN).
- **Phase 4.6 Operations Dashboard** selesai:
  - Realtime Supabase publication untuk `housekeeping_requests` dan `room_service_orders`.
  - Halaman `/operations` dengan tabs dan server actions update status.
- **AI Token Optimization** (2026-04-22) selesai:
  - `lib/ai/context-budget.ts` (budgeted history + trimmed summary, no extra LLM call).
  - Observability token/step usage dari metadata Gemini SDK.
  - Prompt lifecycle dirapikan agar repeated tokens berkurang.

### Test snapshot terkini

- Total file test: **31** (20 unit + 11 integration).
- Verifikasi terfokus yang tercatat di `docs/plan.md`:
  - Task 4.4: 8 file, 33 test pass.
  - Lifecycle + language hardening: 3 file, 20 test pass.
  - Lifecycle observability (2026-04-21): 3 file, 26 test pass.

### Artefak dokumentasi yang sudah ada untuk paper

- `docs/plan.md` (plan utama, selalu update).
- `docs/phase-4/2026-04-21-lifecycle-ai-observability-hardening.md`.
- `docs/phase-4/2026-04-22-operations-dashboard.md`.
- `docs/plans/2026-04-22-ai-token-optimization.md`.
- `docs/runbook.md` (incident playbook sudah berisi kasus nyata AI/WAHA).
- `docs/2026-04-17-conference-paper-readiness-summary.md` (analisis gap ilmiah).

**Implikasi:** Evidence engineering cukup, tinggal dirapikan menjadi format ilmiah singkat. Tidak perlu eksperimen baru yang berat.

## A. Step Prioritas Untuk Abstract Submission (T-7 sampai T-0)

### T-7 s.d. T-5 (hari ini - lusa)

1. Kunci kontribusi paper jadi 3 poin saja:
   - **Reliable PMS-to-WhatsApp automation** (idempotency, dedupe, queue, retry, scheduler) — verified via integration test.
   - **Lifecycle Agentic AI (pre-arrival, on-stay, post-stay)** terintegrasi ke workflow nyata dengan deterministic fallback saat error provider.
   - **Context budgeting + tenant personalization** untuk kualitas balasan stabil dengan biaya token lebih rendah (baseline full-transcript vs budgeted).
2. Finalkan Research Questions (RQ):
   - RQ1: Seberapa andal pipeline event-driven menghindari pesan duplikat dan memulihkan pengiriman gagal?
   - RQ2: Apakah lifecycle Agentic AI dapat menggantikan alur manual post-stay tanpa menurunkan kualitas balasan?
   - RQ3: Berapa penurunan token input setelah budgeted context + prompt compaction dibandingkan full-transcript replay?
   - RQ4: Apakah language routing berbasis pola nomor cukup akurat vs metode detect-language model?
3. Baseline minimum (cukup 2-3 level, sesuai skala TA):
   - Baseline A: Manual/template tanpa AI follow-up.
   - Baseline B: Agentic AI tanpa budget + tanpa personalization (replay full transcript).
   - Proposed: Agentic AI + context budget + tenant AI settings + phone-based language routing.
4. Kumpulkan angka awal yang **sudah ada** (tidak perlu eksperimen baru):
   - Test pass snapshot (gabungkan 3 snapshot jadi satu angka agregat).
   - Jumlah file + fungsi core reliability.
   - Jumlah migrasi Phase 4 yang mendukung automation.
   - Angka token usage Gemini dari log debug (`LIFECYCLE_AI_DEBUG=true`) untuk before/after budgeted context — simpan 5 sesi sample.

**Output wajib fase ini:**

- Judul final, kontribusi 3 bullet, RQ final, baseline list final.
- Folder `results/` dengan kumpulan angka mentah (txt/csv ringan).

### T-4 s.d. T-2

1. Tulis abstract 150-250 kata mengikuti struktur ketat:
   - Problem (proses loyalitas tamu pasca-menginap fragmented + beban operasional messaging manual).
   - Gap (solusi existing jarang menggabungkan reliability + agentic personalization + observability + biaya token).
   - Pendekatan (arsitektur PMS-WAHA-Agentic AI event-driven + tenant-aware personalization + context budgeting).
   - Hasil awal terukur (test pass ratio, angka token reduction, deterministic fallback coverage).
   - Novelty (integrated, reproducible hospitality automation framework pada stack Next.js + Supabase + WAHA + Gemini).
2. 5-7 keyword: `hotel PMS integration`, `WhatsApp automation`, `agentic AI`, `event-driven reliability`, `context budgeting`, `guest loyalty`, `multilingual routing`.
3. 1 paragraf expected empirical evidence agar konsisten dengan paper full.
4. Sanity check klaim — setiap klaim harus punya file atau log pembuktian.

**Output wajib fase ini:** abstract v1 + v2, keyword set final.

### T-1 s.d. T-0 (hari submit)

1. Cek format venue (word limit, track, COI form, author metadata).
2. Pastikan mode review (anonymized vs camera-ready).
3. Submit H-1 malam, tidak menunggu jam terakhir.
4. Simpan bukti submit: PDF final, ID submission, metadata.

## B. Checklist Konten Abstract (Template Cepat)

Gunakan 5 kalimat inti (versi disesuaikan proyek):

1. Hospitality loyalty operations masih fragmented: PMS, messaging, dan follow-up tamu ditangani manual dengan risiko duplikat pesan dan latensi tinggi.
2. Solusi existing jarang menyatukan _reliability engineering_ (dedupe, queue, retry) dengan _agentic AI_ lintas lifecycle (pre-arrival, on-stay, post-stay) dan pengendalian biaya token.
3. Kami membangun arsitektur terintegrasi PMS-WAHA-Agentic AI berbasis event, idempotency, tenant-aware personalization, dan context budgeting untuk Gemini.
4. Evaluasi fungsional pada 31 file test (gabungan snapshot: 79 test pass) menunjukkan pipeline stabil, sedangkan sample 5 percakapan post-stay menunjukkan pengurangan input-token setelah budgeted context aktif.
5. Kontribusi: framework implementatif + protokol evaluasi sederhana yang dapat direplikasi untuk domain hospitality loyalty automation.

## C. Format Paper (Referensi: `draft paper.md`)

Draft paper contoh (GUI vs VUI di Flutter) dipakai sebagai **referensi format short paper**. Struktur minimal yang dipakai:

1. **Abstract** (paragraph tunggal 5-8 kalimat).
2. **Introduction** (masalah, solusi, tujuan).
3. **Methodology** (device/environment, arsitektur, metrik, skenario, jumlah iterasi).
4. **Results and Discussion** (sub-bagian dengan sub-judul jelas, diselingi 1-2 formula atau angka kunci).
5. **Recommendations & Conclusion** (3 rekomendasi arsitektural + ringkasan).

Catatan adaptasi untuk aplikasi ini:

- Metrik grafis (Jank Ratio) tidak relevan karena proyek ini web app server-driven, bukan Flutter animation.
- Metrik yang dipakai adalah **reliability, token efficiency, latency, language-routing accuracy**, yang semuanya bisa dibaca dari log/test yang sudah ada.
- "Iterasi 5 kali" tetap dipertahankan sebagai pola agar eksperimen ringan dan mudah direplikasi.

## D. Metodologi Ringan yang Cocok Untuk Anda

Semua metodologi berikut memakai tooling yang **sudah ada di proyek**. Tidak perlu infrastruktur tambahan.

### D.1 Environment eksperimen

- Next.js 14 App Router production build (`pnpm build && pnpm start`).
- Supabase project (dev) + migration terbaru.
- WAHA self-hosted via Docker (`docker compose up`).
- Gemini `gemini-2.5-flash` (satu model konsisten, tidak ada fallback model).
- Jalankan di satu laptop developer (cukup sebutkan spec, mis. Windows 10, Node 20, RAM X, dsb.).

### D.2 Skenario eksperimen (5 iterasi per skenario)

| No  | Skenario                          | Trigger                                   | Data kunci yang dicatat                                              |
| --- | --------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| S1  | Reservation confirmed -> pesan    | Sync PMS mock ke status `confirmed`       | Waktu enqueue -> delivered, dedupe count                             |
| S2  | Duplicate webhook                 | Replay event sama 3x                      | Jumlah send aktual vs payload                                        |
| S3  | Retry setelah WAHA gagal          | Matikan WAHA sementara, jalankan cron     | Retry attempt, waktu recovery, status akhir                          |
| S4  | Post-stay AI follow-up            | Guest balas "3, kamarnya bersih"          | Tool-call count, step count, token usage (debug log), status akhir   |
| S5  | On-stay request (housekeeping)    | Guest minta handuk di WhatsApp            | Tool-call, row masuk `housekeeping_requests`, latensi realtime /ops  |

Setiap skenario dijalankan **5 kali** (seperti draft paper Flutter).
Semua data dicatat dari:

- `message_logs` (status, timestamps).
- `inbound_events` (dedupe).
- Log debug Gemini (token usage, steps, toolCalls).
- Tabel `room_service_orders` / `housekeeping_requests`.

### D.3 Komparasi token (Ablation ringan)

- Jalankan S4 dengan `CONTEXT_BUDGET_ENABLED=false` (5x) dan `true` (5x).
- Catat `usage.inputTokens`, `usage.outputTokens`, jumlah step.
- Hitung rata-rata, simpan sebagai tabel.

### D.4 Metrik

| Kategori                 | Metrik                               | Sumber data                                 |
| ------------------------ | ------------------------------------ | ------------------------------------------- |
| Reliability              | Delivery success rate                | `message_logs.status`                       |
| Reliability              | Duplicate suppression rate           | `inbound_events` unique vs payload count    |
| Reliability              | Retry recovery rate                  | `automation_jobs` attempts + final status   |
| AI quality               | Tool-call success rate               | Lifecycle debug log                         |
| AI quality               | Structured extraction accuracy       | Manual cek 5 sample S4                      |
| Cost                     | Avg input tokens per turn (before/after) | Gemini usage metadata                       |
| Cost                     | Avg output tokens per turn              | Gemini usage metadata                       |
| Latency                  | Webhook -> send latency p50/p95      | Timestamp log                               |
| Latency                  | Realtime operations update delay     | Log realtime client                         |
| Language routing         | Accuracy on sample phone list        | 20 nomor test (10 ID, 10 non-ID)            |

**Mengapa metodologi ini mudah:**

- Tidak butuh user study.
- Tidak butuh ground-truth labeling skala besar (cukup 5 sample per skenario).
- Semua data dibaca dari log/DB yang **sudah di-instrument**.
- Test suite (`pnpm test`) sebagai bukti functional correctness (cukup di-cite sebagai angka agregat).

### D.5 Formula yang layak di-highlight

- Reliability delivery rate:
  \[
  \text{Delivery Rate} = \frac{\text{successful\_sends}}{\text{total\_attempts}}
  \]

- Token reduction:
  \[
  \text{Token Reduction} = 1 - \frac{\bar{T}_{\text{budgeted}}}{\bar{T}_{\text{baseline}}}
  \]

Formula dipasang seperti pola `$$...$$` di `draft paper.md`.

## E. Step Menuju Camera-Ready (Setelah Accepted)

### Fase 1: Keputusan diterima (A+0 sampai A+3)

1. Kelompokkan reviewer comments: mandatory / recommended / optional.
2. Buat response matrix (komentar -> tindakan -> lokasi perubahan).
3. Freeze scope: hanya tingkatkan acceptance compliance, tidak membuka fitur baru.

### Fase 2: Revisi teknis dan naskah (A+4 sampai A+10)

1. Tambahkan angka final:
   - Ulang 5 iterasi per skenario dengan environment bersih.
   - Tambahkan ablation komplit (S4 before/after budget) dan summary statistik sederhana (mean, stdev, 95% CI).
2. Lengkapi Threats to Validity dan Ethical/Privacy statement.
3. Rapikan figure dan tabel agar self-contained (arsitektur, sequence, tabel hasil).
4. Finalisasi reproducibility appendix (commit hash, env sample, dataset anonim sample).

### Fase 3: Formatting dan compliance (A+11 sampai A+13)

1. Ubah mode anonymized ke camera-ready (author metadata lengkap).
2. Terapkan template final venue (copyright, DOI placeholder).
3. Pastikan page limit, referensi, font/margin, PDF compliance check (PDF eXpress).
4. Lengkapi administrasi (copyright form, registration, source upload).

### Fase 4: Final submit (A+14)

1. Upload camera-ready PDF.
2. Upload source/bib/figures jika wajib.
3. Verifikasi metadata online == PDF.
4. Simpan receipt + arsip final.

## F. Kegagalan Paling Sering (Wajib Dihindari)

1. Abstract terlalu produk-sentris, tidak menonjolkan novelty ilmiah.
2. Klaim "real-time" dan "personalized" tanpa angka pendukung.
3. Lupa switch mode anonymized vs camera-ready.
4. Revisi camera-ready melebar ke fitur baru.
5. Submit mepet deadline tanpa buffer.
6. Melompat ke eksperimen baru berat padahal evidence engineering sudah cukup untuk short paper.

## G. 3 Deliverable yang Harus Selesai Minggu Ini

1. **Abstract final** (siap submit) + keyword set.
2. **Draft paper** (file: `draft paper.md` versi app ini — sudah disiapkan).
3. **Results table** ringkas: 5 iterasi x 5 skenario + ablation token (cukup dari log yang sudah ada).

## H. Bukti / Referensi Internal yang Dipakai

1. `docs/plan.md` — source of truth status Phase 0-4.
2. `docs/2026-04-17-conference-paper-readiness-summary.md` — daftar gap ilmiah yang sudah dipetakan.
3. `docs/phase-4/2026-04-21-lifecycle-ai-observability-hardening.md` — bukti observability AI siap dipanen sebagai metrik.
4. `docs/phase-4/2026-04-22-operations-dashboard.md` — bukti integrasi AI -> operasi staf real-time.
5. `docs/plans/2026-04-22-ai-token-optimization.md` — desain ablation token.
6. `docs/runbook.md` — bukti kematangan operasional (dapat dirujuk di bagian "deployment / reliability").
7. Test snapshots (31 file test, snapshot terfokus 79 test pass gabungan) — cite langsung di paper.

## I. Referensi Eksternal (dari pencarian Exa)

- IAICT 2026 & IEEE LSC author guide: short paper 4-5 halaman, IEEE two-column, struktur standar (Abstract -> Intro -> Method -> Results -> Conclusion).
- "Types of IEEE Conference Papers" (conferencealert 2024): short paper < 4 halaman, fokus hasil preliminer.
- HAL "AI in Hotel PMS" (2024): positioning AI pada PMS operasional.
- SAGE "Agentic AI in Hospitality and Tourism" (2025): framing taxonomy agent hospitality.
- RJWave JAAFR (2025): WhatsApp chatbot dalam hospitality, gap empiris.
- ACL EACL 2026 "HotelQuEST": cost-aware agentic evaluation — relevan sebagai sitasi cost/efficiency.

Sitasi ini cukup untuk Related Work pendek (~6-8 referensi) di short paper.
