# QloApps Webhook Setup Guide

## Tujuan

Panduan ini menjelaskan langkah implementasi di sisi QloApps agar sinkronisasi PMS dapat berjalan dengan model **webhook-first + fallback reconciliation**.

Fokus dokumen ini adalah sisi QloApps:

- hook apa yang dipakai,
- data apa yang dikirim,
- bagaimana menandatangani request,
- bagaimana menguji integrasi sebelum production.

---

## Gambaran Umum

QloApps tidak secara default bertindak sebagai event bus untuk aplikasi eksternal Anda. Karena itu, pendekatan yang direkomendasikan adalah membuat **custom module** yang:

1. mendaftar ke hook QloApps,
2. menangkap event reservasi,
3. membangun payload JSON,
4. menandatangani payload dengan shared secret,
5. mengirim `POST` ke endpoint aplikasi Anda.

---

## Prasyarat

Sebelum memulai, pastikan:

1. QloApps sudah berjalan normal.
2. Back office dapat diakses.
3. Webservice API QloApps sudah aktif.
4. Anda sudah punya:
   - URL aplikasi penerima webhook,
   - shared secret,
   - tenant key atau identifier hotel,
   - akses untuk memasang custom module.

Untuk integrasi ini, nilai `Shared Secret` di module QloApps harus sama persis dengan `PMS_WEBHOOK_SECRET` di aplikasi.

Contoh:

- aplikasi: `PMS_WEBHOOK_SECRET=super-secret-123`
- module QloApps: `Shared Secret = super-secret-123`

Jika environment masih lokal, gunakan URL yang dapat diakses oleh instance QloApps. Bila QloApps berjalan di container terpisah, pastikan hostname/port tujuan bisa di-resolve dari container atau host tempat QloApps berjalan.

Catatan lokal yang penting:

- jika aplikasi Next.js berjalan di host Windows dan QloApps berjalan di Docker, gunakan `http://host.docker.internal:3000/api/webhooks/pms`
- jangan gunakan `http://localhost:3000/api/webhooks/pms` dari dalam container QloApps karena `localhost` akan mengarah ke container itu sendiri

---

## Hook yang Dipakai

### 1. `actionValidateOrder`

**Kapan dipicu:**

- Setelah order baru tervalidasi dan dibuat.

**Gunanya:**

- Menandai adanya booking baru.
- Mengirim event `booking.created`.

### 2. `actionPaymentConfirmation`

**Kapan dipicu:**

- Saat order masuk ke status payment accepted.

**Gunanya:**

- Mengirim event `booking.payment_confirmed`.
- Berguna untuk milestone order/payment, tetapi **bukan** penentu tunggal bahwa tamu sudah `on-stay`.

### 3. `actionOrderStatusPostUpdate`

**Kapan dipicu:**

- Setelah status order benar-benar berubah.

**Gunanya:**

- Mengirim event `booking.order_status_changed`.
- Menangkap perubahan di domain order/payment/cancel.
- Berguna untuk observabilitas, tetapi tidak boleh dipakai sendiri untuk memutuskan lifecycle stay.

### 4. `actionRoomBookingStatusUpdateAfter`

**Kapan dipicu:**

- Setelah status room booking berubah.

**Gunanya:**

- Mengirim event `booking.room_status_changed`.
- Ini hook yang penting untuk perubahan lifecycle kamar seperti allotment, check-in, check-out, dan cancel berbasis room booking.
- Untuk status stay lokal, hook ini adalah sinyal yang paling penting.

### Hook opsional: `actionOrderStatusUpdate`

Gunakan hanya jika memang perlu observasi sebelum perubahan disimpan. Untuk integrasi eksternal, `PostUpdate` biasanya lebih aman.

---

## Struktur Module yang Direkomendasikan

Buat module custom, misalnya bernama `loyalinnwebhooksync`.

Struktur minimal yang direkomendasikan:

- file module utama PHP,
- method install/uninstall,
- method register hooks,
- halaman konfigurasi sederhana,
- helper untuk signing dan HTTP POST,
- logger sederhana.

### Konfigurasi yang perlu tersedia di back office

- `Webhook Endpoint URL`
- `Tenant Key`
- `Shared Secret`
- `Enabled/Disabled`
- `Send Test Event` button

Pastikan `Enabled` benar-benar tersimpan sebagai aktif pada shop/context yang sedang dipakai. Test event manual bisa berhasil walau real hook runtime masih tidak mengirim jika state module runtime tidak aktif.

Jika ingin lebih aman, tambahkan juga:

- timeout request,
- retry count,
- toggle event types yang dikirim.

---

## Payload yang Disarankan

Payload dibuat sesederhana mungkin.

### Field minimum

- `event_type`
- `tenant_key`
- `id_order`
- `id_customer` jika tersedia
- `occurred_at`
- `event_id`
- `order_status_code` untuk event order/payment
- `room_status_code` untuk event room lifecycle

Field `status_code` lama boleh tetap dikirim sebagai fallback kompatibilitas, tetapi sebaiknya jangan lagi dijadikan satu-satunya field status.

Catatan: `tenant_key` bukan nama hotel bebas. Nilainya harus cocok persis dengan `tenants.slug`.

### Contoh payload event payment/order

```json
{
  "event_type": "booking.payment_confirmed",
  "tenant_key": "hotel-001",
  "event_id": "qloapps-ord-120-payment-confirmed-2026-05-10T09:30:00Z",
  "id_order": 120,
  "id_customer": 45,
  "order_status_code": 2,
  "occurred_at": "2026-05-10T09:30:00Z"
}
```

### Contoh payload event room lifecycle

```json
{
  "event_type": "booking.room_status_changed",
  "tenant_key": "hotel-001",
  "event_id": "qloapps-room-120-checked-in-2026-05-10T14:00:00Z",
  "id_order": 120,
  "id_customer": 45,
  "room_status_code": 2,
  "occurred_at": "2026-05-10T14:00:00Z"
}
```

### Catatan desain

- Jangan kirim seluruh objek order mentah jika tidak perlu.
- Backend aplikasi Anda lebih cocok melakukan enrichment tambahan memakai API QloApps.
- Payload kecil lebih mudah dipertahankan ketika struktur internal QloApps berubah.
- Pisahkan status order dan status room agar backend tidak salah memetakan `payment accepted` sebagai `on-stay`.

---

## Signature dan Header Request

Agar aman, module harus mengirim signature HMAC dari **raw JSON body**.

### Header yang direkomendasikan

- `Content-Type: application/json`
- `X-PMS-Timestamp: <unix timestamp atau ISO time>`
- `X-PMS-Signature: <hex hmac>`
- `X-PMS-Source: qloapps`

Header `X-PMS-Timestamp` dan `X-PMS-Signature` akan diverifikasi backend memakai `PMS_WEBHOOK_SECRET` yang sama.

### Mekanisme signature

1. Serialize payload JSON.
2. Gabungkan timestamp + body bila itu pola verifikasi backend Anda.
3. Hitung HMAC SHA-256 dengan shared secret.
4. Kirim hasilnya pada header signature.

### Formula yang direkomendasikan

```text
signature = HMAC_SHA256(secret, timestamp + "." + rawBody)
```

Ini cocok bila backend Anda ingin mencegah replay attack sekaligus memastikan integritas payload.

---

## Alur Implementasi di QloApps

## Step 1 — Siapkan endpoint aplikasi

Pastikan endpoint webhook PMS di aplikasi Anda adalah route berikut:

- `/api/webhooks/pms`

Contoh URL yang dipasang di konfigurasi module:

- production: `https://your-domain.com/api/webhooks/pms`
- staging: `https://staging.your-domain.com/api/webhooks/pms`
- local/dev: URL tunnel publik yang mengarah ke `/api/webhooks/pms`

Pastikan endpoint tersebut:

- bisa diakses dari lokasi QloApps,
- memakai HTTPS pada production,
- memverifikasi signature,
- mengembalikan respons JSON yang jelas.

Contoh response sukses yang baik:

```json
{
  "received": true,
  "duplicate": false,
  "job_enqueued": true
}
```

Untuk event `booking.test`, perlakukan response sukses hanya sebagai verifikasi jaringan, signature, dan parsing payload. Event ini bukan bukti bahwa hook `actionValidateOrder`, `actionOrderStatusPostUpdate`, atau `actionRoomBookingStatusUpdateAfter` benar-benar sudah mengirim di runtime.
