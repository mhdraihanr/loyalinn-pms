# QloApps Webhook-First Runtime Cutover Checklist

Checklist ini dipakai saat perubahan code sudah selesai dan siap dipindahkan dari hybrid/polling-heavy ke webhook-first.

## 1. Pre-Cutover Checks

- [ ] QloApps module `loyalinnwebhooksync` sudah terinstall.
- [ ] Module aktif di Back Office QloApps.
- [ ] `Tenant Key` di module sama persis dengan `tenants.slug`.
- [ ] `Webhook Endpoint URL` mengarah ke `https://<app-domain>/api/webhooks/pms`.
- [ ] `Shared Secret` sama dengan `PMS_WEBHOOK_SECRET` di aplikasi.
- [ ] Tenant punya `pms_configurations` aktif dengan `pms_type = 'qloapps'`.
- [ ] QloApps endpoint dan credentials tenant valid untuk enrichment.
- [ ] Hook `actionValidateOrder` aktif.
- [ ] Hook `actionPaymentConfirmation` aktif.
- [ ] Hook `actionOrderStatusPostUpdate` aktif.
- [ ] Hook `actionRoomBookingStatusUpdateAfter` aktif.

## 2. Code Behavior Required Before Cutover

- [ ] Webhook route menerima event QloApps dan memvalidasi HMAC.
- [ ] Event disimpan ke `inbound_events` secara idempotent.
- [ ] Duplicate webhook tidak membuat guest/reservation/job ganda.
- [ ] Webhook processor mengambil detail booking dari QloApps.
- [ ] Webhook processor meng-upsert `guests`.
- [ ] Webhook processor meng-upsert `reservations`.
- [ ] `automation_jobs.reservation_id` terisi untuk job yang dibuat dari webhook.
- [ ] `inbound_events.processed` menjadi `true` setelah sukses.
- [ ] Error enrichment/persistence tersimpan di `inbound_events.processing_error`.
- [ ] Order/payment status tidak langsung diperlakukan sebagai `on-stay` tanpa verifikasi room booking.
- [ ] Room booking status hasil enrichment menjadi sumber kebenaran untuk transisi `on-stay`, `checked-out`, dan `cancelled`.

## 3. Reconciliation Mode

- [ ] Polling lama tidak dihapus.
- [ ] Polling diganti nama/posisi sebagai reconciliation.
- [ ] Production cron tidak lagi berjalan setiap 5 menit.
- [ ] Reconciliation hanya berjalan jika `PMS_RECONCILIATION_ENABLED=true` atau dipicu manual.
- [ ] Dev polling hanya berjalan jika `PMS_DEV_SYNC_ENABLED=true`.

## 4. UAT Scenario

### Booking Created

- [ ] Buat booking baru di QloApps.
- [ ] Pastikan webhook `booking.created` masuk ke `inbound_events`.
- [ ] Pastikan `reservations.pms_reservation_id` sama dengan `id_order`.
- [ ] Pastikan data guest masuk ke `guests`.
- [ ] Pastikan status lokal awal tetap aman sebagai `pre-arrival` bila tamu belum checked-in.

### Payment Confirmed

- [ ] Ubah order menjadi payment accepted di QloApps.
- [ ] Pastikan webhook `booking.payment_confirmed` masuk.
- [ ] Pastikan status reservation tetap `pre-arrival` jika room booking belum checked-in.

### Order Status Changed

- [ ] Ubah status order di QloApps.
- [ ] Pastikan webhook `booking.order_status_changed` masuk.
- [ ] Pastikan perubahan order status saja tidak memaksa reservation menjadi `on-stay` bila room booking belum berubah.

### Room Status Changed — Check-in

- [ ] Ubah room booking status ke checked-in.
- [ ] Pastikan webhook `booking.room_status_changed` masuk.
- [ ] Pastikan status lokal menjadi `on-stay`.
- [ ] Pastikan automation job dibuat jika transisi masuk policy trigger.

### Room Status Changed — Check-out

- [ ] Ubah room booking status ke checked-out.
- [ ] Pastikan webhook `booking.room_status_changed` masuk.
- [ ] Pastikan status lokal menjadi `checked-out`.

### Cancellation

- [ ] Batalkan booking/order di QloApps.
- [ ] Pastikan status lokal menjadi `cancelled` sesuai hasil enrichment room/order yang dipetakan.
- [ ] Pastikan cleanup/cancellation job dibuat jika policy trigger aktif.

## 5. Monitoring After Cutover

Pantau selama 24-48 jam:

- [ ] jumlah webhook masuk per tenant.
- [ ] duplicate rate di `inbound_events`.
- [ ] `processing_error` tidak meningkat.
- [ ] jumlah reservation dari webhook sesuai aktivitas QloApps.
- [ ] reconciliation harian tidak menemukan banyak gap.
- [ ] event room-status benar-benar muncul untuk check-in/check-out nyata, bukan hanya `booking.test`.

## 6. Rollback Plan

Jika webhook path bermasalah:

1. Set `PMS_RECONCILIATION_ENABLED=true`.
2. Jalankan reconciliation manual atau aktifkan cron fallback sementara.
3. Jangan uninstall module QloApps kecuali module menyebabkan error di QloApps.
4. Periksa `inbound_events.processing_error` untuk akar masalah.
5. Setelah fix, aktifkan lagi webhook-first runtime.
