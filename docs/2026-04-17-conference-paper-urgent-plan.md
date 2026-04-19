# Urgent Plan: Abstract Deadline + Camera-Ready

## Konteks

Target utama sekarang: **abstrak submission minggu depan**.
Dokumen ini hanya memuat hal paling penting agar peluang submit aman, lalu jalur lanjutan menuju camera-ready.

## A. Step Prioritas Untuk Abstract Submission (T-7 sampai T-0)

## T-7 s.d. T-5 (hari ini sampai 2-3 hari ke depan)

1. Kunci kontribusi paper jadi 3 poin saja:
   - Reliable PMS-to-WhatsApp automation (idempotency, queue, retry, scheduler).
   - Agentic AI post-stay follow-up yang terintegrasi ke workflow nyata.
   - Personalisasi + language routing berbasis konteks tenant/nomor.
2. Finalkan 2-4 Research Questions (RQ) yang akan dijawab hasil eksperimen.
3. Tentukan baseline minimum (rule-based, manual follow-up, agentic non-personalized, proposed).
4. Kumpulkan angka awal yang sudah ada (minimal):
   - test pass snapshot,
   - status implementasi end-to-end,
   - metrik reliability awal (jika tersedia).

Output wajib fase ini:

- draft judul final,
- kontribusi final (3 bullets),
- RQ final,
- baseline list final.

## T-4 s.d. T-2

1. Tulis abstract 150-250 kata (atau sesuai CFP venue) dengan struktur ketat:
   - problem,
   - gap,
   - pendekatan,
   - hasil awal/claim terukur,
   - novelty.
2. Tulis 5-7 keyword yang sangat tepat domain (hotel PMS, WhatsApp automation, agentic AI, loyalty analytics, real-time monitoring).
3. Siapkan 1 paragraf "expected empirical evidence" untuk sinkron dengan paper full.
4. Lakukan sanity check claim: jangan ada klaim yang belum punya rencana bukti.

Output wajib fase ini:

- abstract v1,
- abstract v2 (setelah review internal),
- keyword set final.

## T-1 s.d. T-0 (hari submit)

1. Cek format sesuai venue:
   - word/character limit abstract,
   - topik track,
   - conflict of interest form,
   - author metadata.
2. Cek mode review:
   - bila double-blind, hilangkan identitas institusi dari naskah anonymized.
3. Submit lebih awal (target H-1 malam), jangan menunggu deadline jam terakhir.
4. Simpan bukti submit:
   - PDF final yang diupload,
   - ID submission,
   - metadata final (title/author/keywords/abstract).

Output wajib fase ini:

- submitted abstract + submission ID,
- arsip final package di folder lokal.

## B. Checklist Konten Abstract (Template Cepat)

Gunakan 5 kalimat inti:

1. Latar masalah: proses loyalitas tamu pasca-menginap masih manual, fragmented, dan tidak real-time.
2. Gap: solusi existing biasanya fokus messaging otomatis saja, belum kuat di reliability + agentic personalization + observability.
3. Metode: kami membangun arsitektur integrasi PMS-WAHA-Agentic AI berbasis event, idempotency, queue/retry, dan tenant-aware personalization.
4. Hasil awal: sistem end-to-end berjalan dengan validasi test integration/unit dan hardening operasional pada dedupe, language routing, dan fallback deterministic.
5. Kontribusi: framework implementatif + protokol evaluasi yang dapat direplikasi untuk domain hospitality loyalty automation.

## C. Step Menuju Camera-Ready (Setelah Dinyatakan Accepted)

## Fase 1: Keputusan diterima (A+0 sampai A+3)

1. Baca seluruh reviewer comments, kelompokkan menjadi:
   - mandatory revisions,
   - recommended revisions,
   - optional improvements.
2. Buat response matrix (komentar -> tindakan -> lokasi perubahan).
3. Freeze scope: hanya perubahan yang meningkatkan acceptance compliance, jangan buka fitur baru.

## Fase 2: Revisi teknis dan naskah (A+4 sampai A+10)

1. Tambahkan hasil eksperimen final:
   - komparasi proposed vs baseline,
   - ablation,
   - analisis statistik ringkas.
2. Lengkapi Threats to Validity dan Ethical/Privacy statement.
3. Rapikan figure dan tabel agar self-contained.
4. Finalisasi reproducibility appendix (dataset anonim, script evaluasi, konfigurasi).

## Fase 3: Formatting dan compliance (A+11 sampai A+13)

1. Ubah mode anonymized ke camera-ready mode (author metadata lengkap).
2. Terapkan template final venue (copyright, DOI placeholder, metadata).
3. Pastikan:
   - page limit,
   - referensi format,
   - font/margin,
   - PDF compliance check (umumnya PDF eXpress/validator venue).
4. Lengkapi administrasi:
   - copyright form,
   - presenter registration,
   - final source upload (jika diminta).

## Fase 4: Final submit (A+14)

1. Upload camera-ready PDF.
2. Upload source/bib/figures jika diwajibkan.
3. Verifikasi metadata online sama persis dengan PDF.
4. Simpan receipt final dan versi arsip final.

## D. Kegagalan Paling Sering (Wajib Dihindari)

1. Abstract terlalu produk-sentris, tidak menonjolkan novelty ilmiah.
2. Klaim "real-time" dan "personalized" tanpa angka atau rencana metrik.
3. Lupa menyesuaikan mode blind vs camera-ready.
4. Revisi camera-ready melebar ke fitur baru sehingga kualitas tulisan turun.
5. Submit mepet deadline tanpa buffer waktu.

## E. Bukti Context7 yang Dipakai untuk Rencana Ini

1. `/borisveytsman/acmart`
   - Opsi mode review anonim dan camera-ready metadata (`anonymous, review` vs `sigconf` normal).
   - Struktur metadata conference/copyright yang harus rapih saat finalisasi.
2. `/vercel/ai`, `/openrouterteam/ai-sdk-provider`
   - Relevan untuk positioning metodologi agentic tool-calling dan konsistensi setting eksperimen AI.
3. `/supabase/supabase`, `/devlikeapro/waha-docs`
   - Relevan untuk framing reliability, RLS/tenant isolation, dan lifecycle messaging real-time.

## F. 3 Deliverable yang Harus Selesai Minggu Ini

1. Abstract final (siap submit) + keyword set.
2. One-page contribution map (Problem -> Gap -> Method -> Early Evidence -> Claimed Contribution).
3. Submission checklist terisi lengkap (format, metadata, admin, deadline buffer).
