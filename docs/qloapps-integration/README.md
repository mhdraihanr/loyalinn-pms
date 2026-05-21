# QloApps Integration Docs

Folder ini menjadi rumah dokumentasi kanonis untuk integrasi QloApps ke aplikasi, mencakup desain arsitektur, setup webhook/module, rencana implementasi runtime, dan checklist cutover.

## Isi

- [Architecture and Sync Design](./architecture-and-sync-design.md)
- [QloApps Webhook Setup Guide](./qloapps-webhook-setup-guide.md)
- [QloApps Module Implementation Plan](./qloapps-module-implementation-plan.md)
- [Runtime Migration Implementation Plan](./runtime-migration-implementation-plan.md)
- [Runtime Cutover Checklist](./runtime-cutover-checklist.md)

## Ringkasan

Cakupan integrasi pada folder ini:

- webhook-first sebagai jalur utama sinkronisasi PMS,
- fallback reconciliation untuk recovery,
- custom module QloApps untuk mengirim event,
- pemisahan domain order/payment dan room/stay,
- room booking status hasil enrichment sebagai sumber kebenaran lifecycle lokal,
- guard duplicate-safe untuk automation lifecycle, terutama `on-stay`,
- observabilitas runtime dan kesiapan cutover.

## Aturan Semantik Penting

- `booking.created`, `booking.payment_confirmed`, `booking.order_status_changed`, dan `booking.room_status_changed` adalah event utama yang didukung.
- `booking.test` hanya memverifikasi konektivitas, signature, dan parsing payload.
- `actionRoomBookingStatusUpdateAfter` wajib aktif untuk transisi lifecycle seperti check-in dan check-out.
- Payment accepted atau order status saja tidak boleh langsung dianggap sebagai `on-stay` tanpa verifikasi room booking hasil enrichment.
- `on-stay` automation hanya boleh dibuat saat status sebelumnya bukan `on-stay` dan status berikutnya `on-stay`.
- Perubahan data lain pada reservasi yang sudah `on-stay` seperti room, amount, source, atau tanggal tidak boleh membuat pesan `on-stay` terkirim ulang.
- Worker status-trigger wajib mengecek `message_logs` sukses untuk pasangan reservation + trigger sebelum mengirim ke WAHA. Jika ada satu atau lebih log `sent`, job baru harus dihentikan sebagai duplicate guard.
