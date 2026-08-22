# QloApps Webhook-First Sync Design

## Goal

Mengubah arsitektur PMS sync saat ini dari **polling-first** menjadi **webhook-first + fallback reconciliation** untuk QloApps, sehingga reservasi baru dan perubahan status dapat diproses hampir real-time tanpa bergantung pada interval sync sebagai jalur utama.

## Latar Belakang

Implementasi saat ini masih memakai dua jalur utama:

1. **Polling cron** untuk mengambil data reservasi per window tanggal.
2. **Webhook ingestion** untuk sebagian event masuk.

Pada implementasi sekarang, cron sync masih menjadi komponen penting karena adapter QloApps melakukan pull data dari webservice, lalu memfilter hasilnya di sisi aplikasi. Pola ini aman untuk bootstrap, tetapi kurang ideal untuk operasi harian karena:

- tidak benar-benar real-time,
- boros API call,
- memperbesar beban integrasi ketika jumlah reservasi tumbuh,
- rawan menarik ulang data yang sebenarnya tidak berubah.

Untuk QloApps, pendekatan yang lebih tepat adalah memanfaatkan **hook event** di sisi PMS untuk mendorong perubahan keluar saat kejadian benar-benar terjadi.

---

## Current State Summary

### Jalur saat ini

- Interval/dev scheduler menjalankan PMS sync berkala.
- Cron PMS melakukan pull reservation berdasarkan window waktu.
- Adapter QloApps mengambil data `room_bookings`, `orders`, `customers`, dan `addresses`.
- Sync service melakukan upsert ke database lokal.
- Jika ada perubahan status penting, automation job di-enqueue.

### Kelemahan utama

1. **Pull-heavy architecture**
   - QloApps webservice lebih cocok dipakai sebagai lookup/read API daripada continuous change feed.

2. **Tidak event-native**
   - Reservasi baru seharusnya diproses saat event booking terjadi, bukan menunggu jadwal interval berikutnya.

3. **Biaya integrasi naik seiring data bertambah**
   - Semakin banyak booking historis, semakin besar biaya scan/filter walaupun perubahan hanya sedikit.

4. **Polling tetap dibutuhkan untuk safety**
   - Ini menunjukkan polling lebih cocok sebagai reconciliation path, bukan primary ingestion path.

---

## Recommended Architecture

### Target: Webhook-first + fallback reconciliation

Arsitektur target:

1. **QloApps custom module** menangkap event internal menggunakan hooks.
2. Module mengirim payload terverifikasi ke endpoint aplikasi.
3. Endpoint aplikasi melakukan:
   - signature verification,
   - timestamp freshness check,
   - idempotency check,
   - optional enrichment ke API QloApps,
   - upsert `guests` dan `reservations`,
   - enqueue automation jobs jika ada perubahan status relevan.
4. **Fallback reconciliation** tetap tersedia, tetapi:
   - dijalankan manual,
   - atau via cron berfrekuensi rendah,
   - atau hanya untuk tenant tertentu saat recovery.

### Design principle

- **Primary path:** push/event-driven
- **Secondary path:** pull/recovery-only
- **Idempotent everywhere:** duplicate webhook harus aman
- **Minimal payload, lazy enrichment:** webhook cukup kirim identifier penting, backend boleh fetch detail tambahan dari QloApps
- **Operationally observable:** setiap event harus dapat ditelusuri dari ingress sampai automation
- **Stay lifecycle truth from room status:** domain order/payment dan domain room/stay harus dipisahkan secara eksplisit

---

## Proposed Event Sources in QloApps

### Hook utama yang direkomendasikan

1. **`actionValidateOrder`**
   - Dipicu saat order baru selesai dibuat.
   - Cocok untuk mendeteksi booking baru.
   - Event yang dikirim: `booking.created`.

2. **`actionPaymentConfirmation`**
   - Dipicu saat pembayaran diterima.
   - Cocok untuk menandai booking yang sudah lolos milestone pembayaran.
   - Event yang dikirim: `booking.payment_confirmed`.

3. **`actionOrderStatusPostUpdate`**
   - Dipicu setelah status order berubah.
   - Cocok untuk observabilitas perubahan order/payment/cancel domain.
   - Event yang dikirim: `booking.order_status_changed`.

4. **`actionRoomBookingStatusUpdateAfter`**
   - Dipicu setelah status room booking berubah.
   - Ini hook penting untuk check-in, check-out, allotment, dan transisi stay lifecycle lain.
   - Event yang dikirim: `booking.room_status_changed`.

### Hook opsional

5. **`actionOrderStatusUpdate`**
   - Dipicu sebelum perubahan status disimpan.
   - Sebaiknya hanya dipakai jika memang perlu kondisi pre-update.
   - Untuk sinkronisasi final, `PostUpdate` lebih aman.

---

## Event Model

### Payload minimum dari QloApps module

Payload webhook tidak perlu membawa seluruh data booking. Payload yang disarankan:

- `event_type`
- `tenant_key`
- `id_order`
- `id_customer` (jika tersedia)
- `order_status_code` untuk event order/payment
- `room_status_code` untuk event room/stay
- `occurred_at`
- `event_id` atau `dedupe_key`

Field `status_code` lama boleh tetap dikirim sebagai fallback kompatibilitas, tetapi backend sebaiknya memprioritaskan field domain-spesifik di atas.

### Contoh event type

- `booking.created`
- `booking.payment_confirmed`
- `booking.order_status_changed`
- `booking.room_status_changed`
- `booking.test`

### Kenapa payload dibuat minimal

Karena QloApps sering lebih stabil dipakai sebagai sumber lookup tambahan setelah event diterima. Dengan payload minimal:

- module lebih sederhana,
- coupling lebih kecil,
- payload lebih stabil walau struktur detail booking berubah,
- backend tetap bisa melakukan enrichment dari webservice resmi QloApps.

### Kenapa field status harus dipisah

Karena QloApps memiliki dua domain yang berbeda:

- **Order/payment status** — mewakili progres order atau pembayaran.
- **Room booking status** — mewakili lifecycle kamar/stay seperti allotted, checked-in, checked-out, cancelled.

Jika keduanya dicampur dalam satu `status_code` tanpa konteks, backend mudah salah memetakan `payment accepted` menjadi `on-stay`. Pemisahan `order_status_code` dan `room_status_code` mencegah bug lifecycle seperti itu.

---

## Backend Processing Flow

### Step 1: Receive webhook

Endpoint menerima request dari module QloApps.

Validasi awal:

- cek HTTP method,
- cek `x-pms-timestamp`,
- cek signature HMAC,
- cek payload JSON valid,
- cek freshness window untuk mencegah replay attack.

### Step 2: Idempotency

Buat `idempotency_key` dari kombinasi berikut:

- `tenant_key`,
- `event_type`,
- `id_order`,
- status domain terkait,
- `occurred_at` atau payload mentah.

Jika key sudah pernah diproses, endpoint cukup return success dengan flag duplicate.

### Step 3: Enrichment dari QloApps API

Setelah webhook lolos validasi, backend boleh melakukan lookup ke QloApps:

- `GET /api/orders/{id}`
- `GET /api/room_bookings?output_format=JSON&display=full`
- `GET /api/customers/{id}`
- `GET /api/addresses?...`

Tujuan enrichment:

- mendapatkan room booking aktual,
- memetakan status ke status internal,
- memastikan phone/email guest lengkap,
- menyusun reservation composite key secara konsisten.

### Step 4: Upsert data lokal

Backend melakukan:

- upsert guest,
- upsert reservation,
- buat inbound event record,
- enqueue automation bila transisi status memang perlu memicu pesan.

### Step 5: Trigger automation

Automation hanya di-enqueue jika transisi memang relevan, misalnya:

- checked-in untuk on-stay flow,
- cancelled untuk stop/cleanup flow.

Jika runtime saat ini hanya memicu real-time automation untuk status tertentu, dokumentasi operasional harus mengikuti rule aktual itu, bukan asumsi semua event memicu job.

---

## Status Mapping Recommendation

Status internal sistem saat ini tetap dipertahankan:

- `pre-arrival`
- `on-stay`
- `checked-out`
- `cancelled`

### Sumber mapping

1. **Primary for stay lifecycle:** status room booking hasil enrichment adapter QloApps
2. **Secondary/contextual:** event type dari module
3. **Order/payment status:** dipakai untuk observabilitas order domain, bukan sumber tunggal lifecycle stay

### Rekomendasi mapping praktis

- `booking.created` → default aman `pre-arrival`
- `booking.payment_confirmed` → tetap `pre-arrival` sampai room booking benar-benar checked-in
- `booking.order_status_changed` → jangan diasumsikan mengubah stay lifecycle; gunakan untuk observasi status order/cancel dan tetap re-check hasil enrichment
- `booking.room_status_changed` + room status checked-in → `on-stay`
- `booking.room_status_changed` + room status checked-out → `checked-out`
- `booking.room_status_changed` + room status cancel / no-show yang dipetakan cancel → `cancelled`

Catatan: keputusan final tetap mengikuti kebijakan bisnis Anda saat ini, khususnya apakah booking tanpa payment accepted perlu masuk lebih awal atau tidak.

---

## Reconciliation Strategy

Karena target Anda adalah opsi 2, polling tidak dihapus total tetapi diturunkan perannya.

### Fungsi reconciliation

Reconciliation dipakai untuk:

- memperbaiki event yang gagal terkirim,
- memperbaiki outage sementara di endpoint webhook,
- memverifikasi konsistensi data lokal vs PMS,
- bootstrap tenant baru jika dibutuhkan.

### Cara menjalankan reconciliation

- manual dari admin/runtime tool,
- cron low-frequency,
- dijalankan khusus saat incident recovery.

---

## Rekomendasi Final

Untuk QloApps, rekomendasi terbaik adalah:

1. pakai **custom webhook module**,
2. kirim **event tipis** dari hook internal QloApps,
3. lakukan **enrichment di backend**,
4. jadikan **room booking status** sebagai sumber utama lifecycle stay,
5. pertahankan **polling hanya sebagai reconciliation path**.

Dengan pola ini, sistem Anda menjadi lebih hemat, lebih real-time, dan lebih aman terhadap bug pemetaan status antara order/payment dan room booking.
