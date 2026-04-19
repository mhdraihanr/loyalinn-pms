# Summary Kesiapan Publikasi Conference

## Judul TA

Integrasi Sistem Manajemen Properti Hotel (PMS) dan Agentic-AI untuk Mendukung Program Loyalitas Tamu Secara Otomatisasi dan Personalisasi dengan Pemantauan Data Secara Real-Time

## Tujuan Dokumen

Dokumen ini merangkum:

1. Kekuatan teknis proyek saat ini untuk dijadikan kontribusi ilmiah.
2. Kesenjangan yang masih harus ditutup agar layak submit conference.
3. Paket eksperimen, artefak, dan roadmap eksekusi menuju naskah siap kirim.

## Ringkasan Eksekutif

Status keseluruhan: **siap untuk masuk fase penelitian terukur**, namun **belum siap submit** karena evidence akademik (baseline, eksperimen komparatif, uji statistik, dan evaluasi dampak) belum lengkap.

Estimasi readiness publikasi (praktis):

- Kematangan sistem engineering: **8.5/10**
- Kematangan evidence ilmiah: **5.5/10**
- Kesiapan naskah conference: **6/10**

Interpretasi:

- Implementasi produk sudah kuat dan end-to-end.
- Agar lolos review conference, proyek perlu naik dari "works in production-like setting" menjadi "proven by reproducible experiments and comparative evaluation".

## Evidence Kuat dari Proyek Saat Ini

### 1. Fondasi arsitektur multi-tenant + keamanan data

- Model tenant-user dan RLS sudah jelas dan terdokumentasi.
- Constraint `1 user -> max 1 tenant` sudah enforced di DB.
- Ini memberikan nilai ilmiah pada aspek **secure multi-tenant automation**.

Referensi internal:

- `docs/architecture-analysis-single-tenant.md`
- `docs/plan.md`

### 2. Pipeline otomasi reliable end-to-end

- Ingestion webhook PMS, deduplikasi, queue, retry, dead-letter, scheduler, observability sudah ada.
- Task 4.4 sudah ditandai selesai dan diverifikasi test terfokus.

Referensi internal:

- `docs/plan.md`
- `docs/phase-4/2026-03-07-phase-4-automation-engine-design.md`
- `docs/phase-4/2026-03-07-phase-4-automation-engine.md`

### 3. Integrasi WAHA operasional

- Session lifecycle, QR authentication, webhook, dan routing event sudah ada.
- Ada hardening pada inbound handling (dedupe, LID mapping, dsb.).

Referensi internal:

- `docs/phase-3/README.md`
- `docs/phase-4/2026-04-09-automation-worker-fixes-and-tools.md`

### 4. Agentic AI sudah masuk workflow nyata

- Post-stay AI follow-up berjalan via webhook WAHA + tool-calling.
- Ada personalisasi tenant (`hotel_name`, `ai_name`, `tone_of_voice`, `custom_instructions`).
- Language routing sudah diperketat (ID vs non-ID) dan fallback handoff dibuat deterministic.

Referensi internal:

- `docs/phase-4/2026-04-12-ai-settings-design.md`
- `docs/phase-4/2026-04-12-ai-settings-implementation.md`
- `docs/plan.md`
- `docs/runbook.md`

### 5. Kultur quality engineering sudah baik

- Unit + integration test dipakai untuk regression prevention.
- Perubahan behavior penting (phone source, language routing, handoff) sudah ada test coverage terfokus.

Referensi internal:

- `tests/unit/**`
- `tests/integration/**`

## Kesenjangan Utama untuk Standar Conference

### A. Gap riset (paling kritis)

1. Belum ada rumusan RQ/Hypothesis formal.
2. Belum ada baseline komparatif yang fair.
3. Belum ada hasil eksperimen kuantitatif dengan uji signifikansi.
4. Belum ada ablation study untuk menunjukkan kontribusi tiap komponen.

### B. Gap data dan evaluasi

1. Belum ada definisi dataset penelitian (periode, jumlah tenant, jumlah reservasi, jumlah percakapan).
2. Belum ada ground-truth labeling terstruktur untuk kualitas respons AI.
3. Belum ada metrik standar loyalitas yang diukur longitudinal.

### C. Gap reproducibility

1. Belum ada skrip pipeline eksperimen terstandar (collect -> clean -> evaluate -> report).
2. Belum ada paket artefak publikasi (dataset anonymized sample, config, seeds, environment spec).
3. Belum ada protokol re-run hasil untuk reviewer.

### D. Gap penulisan ilmiah

1. Threats to validity belum ditulis sistematis.
2. Etika dan privasi (PII handling, consent) perlu diposisikan sebagai bagian metodologi, bukan hanya operasional.
3. Klaim "real-time" dan "personalisasi" perlu dikuantifikasi.

## Kontribusi Ilmiah yang Bisa Diposisikan

Disarankan framing kontribusi paper:

1. **Reliable automation architecture** untuk PMS-to-WhatsApp pipeline berbasis idempotency, queue, retry, dan scheduler.
2. **Agentic feedback orchestration** yang menggabungkan form-based flow dan AI follow-up pada dropout case.
3. **Context-aware personalization** dengan tenant-level prompt controls + language routing berbasis sinyal nomor telepon.
4. **Operational observability and safety guardrails** (dedupe, deterministic handoff fallback, structured logging).
5. **Empirical impact** terhadap metrik layanan/loyalitas (yang harus dibuktikan pada eksperimen).

## Paket Riset yang Perlu Disiapkan

## 1) Research Questions (RQ)

Contoh RQ yang relevan:

- **RQ1:** Apakah arsitektur otomasi berbasis queue + dedupe meningkatkan reliabilitas pengiriman dibanding pendekatan langsung/sederhana?
- **RQ2:** Apakah agentic AI follow-up meningkatkan completion feedback dibanding workflow non-AI?
- **RQ3:** Apakah personalisasi tenant + language routing meningkatkan kualitas interaksi tamu tanpa menaikkan error operasional?
- **RQ4:** Berapa trade-off biaya-latency-kualitas dari penggunaan Agentic-AI pada skenario post-stay?

## 2) Baseline yang wajib ada

Minimal 3 pembanding:

1. **Rule-based only** (template statis, tanpa AI follow-up).
2. **Rule-based + manual follow-up** (human-assisted, tanpa agentic parsing).
3. **Agentic-AI tanpa personalisasi tenant**.
4. **Agentic-AI + personalisasi tenant + language routing** (proposed).

## 3) Metrik evaluasi inti

### Reliabilitas sistem

- Delivery success rate
- Duplicate suppression rate
- Retry recovery rate
- Dead-letter rate
- End-to-end latency (p50/p95)

### Kualitas agentic AI

- Tool-call success rate
- Structured extraction accuracy (rating/comments)
- Language appropriateness accuracy (ID vs non-ID)
- Hallucination/error rate pada respons operasional

### Dampak loyalitas/engagement

- Feedback completion rate
- Response rate to follow-up
- Median time-to-feedback
- (Jika data ada) repeat-stay proxy atau uplift NPS-like score

### Efisiensi operasional

- Manual intervention rate
- Agent handoff rate
- Cost per resolved feedback thread

## 4) Ablation Study (wajib untuk nilai ilmiah)

Uji kontribusi per komponen dengan mematikan satu per satu:

1. Tanpa dedupe inbound.
2. Tanpa retry backoff.
3. Tanpa tenant AI settings personalization.
4. Tanpa phone-based language routing.
5. Tanpa customer-first phone precedence di adapter QloApps.

Tujuan: menunjukkan komponen mana yang paling memberi dampak ke reliabilitas dan kualitas outcome.

## 5) Validitas dan statistik

- Gunakan interval kepercayaan atau uji statistik sederhana (mis. proportion test untuk conversion/completion).
- Pisahkan analisis per segmen tenant agar tidak bias oleh outlier tenant besar.
- Tulis minimal:
  - Internal validity
  - External validity
  - Construct validity
  - Conclusion validity

## Persiapan Data dan Etika

1. Definisikan data dictionary eksperimen.
2. Anonimkan PII (nama, nomor telepon, email) sebelum analisis.
3. Pastikan consent/opt-out tercatat untuk penggunaan data percakapan.
4. Simpan audit trail perubahan status feedback (`pending`, `ai_followup`, `completed`, `ignored`).
5. Siapkan statement etika untuk naskah conference.

## Reproducibility Package (yang perlu disiapkan)

1. `README-research.md` khusus eksperimen.
2. Skrip data extraction + anonymization.
3. Skrip evaluasi metrik dan generator tabel/figure.
4. Versi model, konfigurasi prompt, dan parameter inference.
5. Daftar commit hash yang merepresentasikan experiment snapshot.
6. `results/` folder dengan raw metrics dan summary CSV.

## Rekomendasi Struktur Paper Conference

1. Abstract
2. Introduction (problem + gap + contribution)
3. Related Work (PMS integration, hospitality automation, agentic AI)
4. System Design
5. Methodology and Experimental Setup
6. Results and Analysis
7. Ablation and Error Analysis
8. Threats to Validity
9. Ethical and Privacy Considerations
10. Conclusion and Future Work

## Roadmap 6 Minggu Menuju Submit

### Minggu 1

- Finalisasi RQ, hypothesis, baseline design.
- Freeze protokol eksperimen.

### Minggu 2

- Bangun pipeline logging dataset riset + anonymization.
- Validasi kualitas data.

### Minggu 3

- Jalankan eksperimen baseline A/B/C.
- Kumpulkan metrik reliabilitas dan engagement.

### Minggu 4

- Jalankan ablation study.
- Lakukan analisis statistik.

### Minggu 5

- Tulis draft paper full (v1).
- Buat figure arsitektur, sequence, dan tabel hasil.

### Minggu 6

- Internal review, proofreading, compliance check venue.
- Finalisasi camera-ready submission package.

## Prioritas Eksekusi Paling Penting (Top 10)

1. Tetapkan RQ + hypothesis tertulis.
2. Definisikan baseline eksperimen.
3. Tambahkan pipeline metrik otomatis (reliability + AI quality + loyalty proxy).
4. Siapkan dataset anonim terkontrol.
5. Jalankan uji komparatif proposed vs baseline.
6. Lakukan ablation study.
7. Tambahkan analisis biaya dan latency.
8. Susun threats-to-validity dan etika data.
9. Siapkan paket reproducibility.
10. Tulis naskah sesuai template venue target.

## Catatan Referensi Context7 yang Digunakan

Untuk memastikan rekomendasi sesuai best-practice implementasi stack yang dipakai proyek:

1. **Supabase docs** (`/supabase/supabase`)
   - RLS sebagai kebijakan akses di level data.
   - Konsistensi enforcement RLS pada akses data dan realtime context.
2. **WAHA docs** (`/devlikeapro/waha-docs`)
   - Session lifecycle (`STOPPED`, `SCAN_QR_CODE`, `WORKING`, `FAILED`) dan implikasi operasional.
   - Event/webhook session untuk observability dan reliability.
3. **Vercel AI SDK docs** (`/vercel/ai`)
   - Tool-calling dengan `generateText`.
   - Saran deterministic setup (temperature rendah/0) untuk workflow yang membutuhkan konsistensi.
4. **OpenRouter AI SDK Provider docs** (`/openrouterteam/ai-sdk-provider`)
   - Praktik penggunaan provider untuk text generation/tool-calling.
   - Tracking usage/cost metadata sebagai dasar evaluasi trade-off biaya.

## Kesimpulan

Proyek TA ini **sangat layak** dijadikan paper conference, dengan kekuatan utama pada integrasi sistem nyata dan reliability engineering yang sudah matang. Agar peluang diterima tinggi, fokus utama berikutnya bukan menambah fitur, tetapi menyelesaikan **evidence ilmiah terukur**: baseline, eksperimen komparatif, ablation, statistik, dan reproducibility.
