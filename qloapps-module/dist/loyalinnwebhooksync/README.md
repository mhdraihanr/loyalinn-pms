# LoyalInn Webhook Sync Module

Thin QloApps/PrestaShop module untuk mengirim event reservasi ke aplikasi LoyalInn dengan pola webhook-first.

## Fitur

- Hook `actionValidateOrder` → `booking.created`
- Hook `actionPaymentConfirmation` → `booking.payment_confirmed`
- Hook `actionOrderStatusPostUpdate` → `booking.order_status_changed`
- Hook `actionRoomBookingStatusUpdateAfter` → `booking.room_status_changed`
- Signature HMAC SHA-256 memakai format `timestamp.rawBody`
- Tombol test event dari halaman konfigurasi module
- Logging sederhana ke `logs/webhook.log`

## Struktur

- `loyalinnwebhooksync.php` — main module file
- `classes/LoyalinnWebhookClient.php` — HTTP sender
- `classes/LoyalinnWebhookSigner.php` — HMAC signer
- `classes/LoyalinnWebhookLogger.php` — file logger
- `views/templates/admin/configure.tpl` — admin help block

## Payload yang dikirim

```json
{
  "tenant_key": "tenant-demo",
  "event_type": "booking.created",
  "event_id": "qloapps-booking.created-10-1-abc123",
  "id_order": 10,
  "id_customer": 25,
  "order_status_code": 1,
  "status_code": 1,
  "event_source_hook": "actionValidateOrder",
  "occurred_at": "2026-05-10T10:30:00Z"
}
```

Untuk perubahan lifecycle kamar/check-in/check-out, module mengirim payload room-level:

```json
{
  "tenant_key": "tenant-demo",
  "event_type": "booking.room_status_changed",
  "id_order": 10,
  "id_customer": 25,
  "id_room_booking": 88,
  "id_room": 301,
  "room_status_code": 2,
  "check_in": "2026-05-10 14:00:00",
  "check_out": "0000-00-00 00:00:00",
  "event_source_hook": "actionRoomBookingStatusUpdateAfter",
  "occurred_at": "2026-05-10T10:30:00Z"
}
```

Catatan status:

- `order_status_code` adalah status order/payment QloApps.
- `room_status_code` adalah status lifecycle kamar dari `HotelBookingDetail.id_status`.
- App harus memakai `room_status_code` atau hasil targeted adapter fetch untuk menentukan `pre-arrival`, `on-stay`, dan `checked-out`.

## Header request

- `Content-Type: application/json`
- `X-PMS-Source: qloapps`
- `X-PMS-Timestamp: <unix-seconds>`
- `X-PMS-Signature: <hex-hmac>`

## Konfigurasi di QloApps

Isi field berikut di halaman module:

- `Enabled`
- `Webhook Endpoint URL`
- `Tenant Key`
- `Shared Secret`
- `Request Timeout Seconds`

Nilai `Tenant Key` harus sama persis dengan `tenants.slug` di aplikasi.

Contoh:

- jika `tenants.slug = hotel-001`
- maka isi `Tenant Key` di module = `hotel-001`

Nilai `Shared Secret` harus sama dengan `PMS_WEBHOOK_SECRET` di aplikasi.

Contoh:

- jika `.env.local` aplikasi berisi `PMS_WEBHOOK_SECRET=super-secret-123`
- maka field `Shared Secret` di module QloApps harus diisi `super-secret-123`

Secret ini dipakai untuk membuat signature HMAC SHA-256 dengan format `timestamp.rawBody`, lalu dikirim melalui header `X-PMS-Timestamp` dan `X-PMS-Signature`.

Nilai `Webhook Endpoint URL` harus diarahkan ke endpoint PMS webhook aplikasi:

- production: `https://your-domain.com/api/webhooks/pms`
- local/dev: gunakan URL publik/tunnel yang mengarah ke `/api/webhooks/pms`
- local host app + QloApps Docker: `http://host.docker.internal:3000/api/webhooks/pms`

Catatan penting:

- Jangan pakai `http://localhost:3000/api/webhooks/pms` dari dalam container QloApps.
- `Send Test Event` hanya memvalidasi konektivitas/signature. Itu bukan bukti bahwa hook order/status nyata sudah aktif.
- Perubahan check-in/check-out harus memicu hook `actionRoomBookingStatusUpdateAfter`, bukan hanya hook order/payment.
- Pastikan field `Enabled` benar-benar tersimpan aktif pada context shop yang sedang dipakai.

## Install manual

1. Copy folder `loyalinnwebhooksync` ke folder `modules/` pada instance QloApps.
2. Login ke back office QloApps.
3. Buka halaman Modules.
4. Cari `LoyalInn Webhook Sync`.
5. Install module.
6. Buka konfigurasi module dan isi endpoint + secret.
7. Klik `Send Test Event`.
8. Cek response pada aplikasi dan file `logs/webhook.log`.

## ZIP-ready packaging

Dari root repo ini, jalankan script packaging:

- `npm run package:qloapps-module`

Output ZIP akan dibuat di:

- `qloapps-module/dist/loyalinnwebhooksync.zip`

ZIP tersebut siap di-upload dari back office QloApps jika diperlukan.

## Catatan

- Module ini sengaja tipis. Enrichment booking detail tetap dilakukan di app backend.
- Jika webhook gagal, recovery tetap dilakukan lewat reconciliation path di aplikasi.
- Untuk runtime normal, reconciliation adalah fallback, bukan mekanisme sync utama.
