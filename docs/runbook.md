# Operational Runbook

## Overview

This runbook provides procedures for monitoring, troubleshooting, and responding to incidents in the Hotel PMS Integration & WhatsApp Automation system.

## Runtime Modes

### Webhook-first mode

Default operating mode for QloApps production tenants.

- QloApps pushes booking/status events to `POST /api/webhooks/pms`.
- The app verifies `X-PMS-Timestamp` and `X-PMS-Signature` using `PMS_WEBHOOK_SECRET`.
- The app normalizes the payload, persists `inbound_events`, enriches reservation details from QloApps, upserts local guest/reservation state, then enqueues automation.
- Default dashboard behavior no longer performs a 10-second browser auto-refresh loop.

Recommended settings:

- `PMS_RECONCILIATION_ENABLED=false`
- `PMS_DEV_SYNC_ENABLED=false`

### Reconciliation mode

Use only for recovery, audits, or gap repair.

- Endpoint: `GET /api/cron/pms-sync`
- When disabled, the route returns `{ "skipped": true, "reason": "PMS reconciliation disabled" }`.
- In hosted production, low-frequency cron is acceptable; it is not the primary sync path.

Recommended settings:

- `PMS_RECONCILIATION_ENABLED=true` only when the route should run.
- Protect the route with the cron bearer secret.

### Development polling mode

Use only when intentionally validating adapter pull behavior.

- Controlled by `PMS_DEV_SYNC_ENABLED` and `DEV_PMS_SYNC_INTERVAL_MS`.
- If this mode is disabled but logs still look periodic, inspect the automation development scheduler before assuming PMS polling is active.

### Development automation scheduler

This is separate from PMS reconciliation.

- Controlled by `DEV_AUTOMATION_SYNC_ENABLED` and `DEV_AUTOMATION_SYNC_INTERVAL_MS`.
- It can still create interval-like logs in `pnpm dev` even when PMS webhook-first mode is working correctly.

## Monitoring

### Key Metrics

1. **Authentication**
   - Failed login attempts
   - Session refresh failures
   - Token expiration rate

2. **PMS Integration**
   - Webhook delivery success rate
   - Sync job completion time
   - Failed reservation syncs

3. **WhatsApp Messaging**
   - Message delivery rate
   - Failed sends
   - WAHA session status

4. **Database**
   - Query performance
   - Connection pool usage
   - RLS policy violations

### Log Tracing

All logs include structured context:

- `requestId`: Trace a single request end-to-end
- `tenantId`: Filter by tenant
- `reservationId`: Track reservation lifecycle
- `jobId`: Follow automation job execution

Example log query:

```
requestId:"abc-123" AND level:"error"
```

## Incident Response

### PMS Down

**Symptoms:**

- Webhook timeouts
- Failed reservation syncs
- Stale reservation data

**Actions:**

1. Check PMS status page
2. Verify PMS credentials in `pms_configurations`
3. Check webhook endpoint accessibility
4. Review `inbound_events` for processing errors
5. If extended outage, notify tenants

**Recovery:**

- Webhooks remain the primary path when PMS becomes reachable again.
- Trigger `GET /api/cron/pms-sync` with the cron bearer token only if immediate reconciliation is required.
- Check for data gaps after recovery.

### WAHA Down

**Symptoms:**

- Failed message sends
- Session disconnected
- QR code not loading

**Actions:**

1. Check WAHA service status
2. Verify WAHA API key validity
3. Check `waha_configurations.is_connected`
4. Restart WAHA session if needed
5. Review `message_logs` for failed sends

**Recovery:**

- Failed messages will retry per retry policy
- Retryable automation jobs are re-queued as `pending` with a future `available_at`; they are claimable again once that time is reached
- Reconnect WhatsApp session via QR
- Check dead-letter queue for unrecoverable failures
- In local `pnpm dev`, remember the in-process development automation scheduler may consume the retried job before a manual `curl /api/cron/automation` call, so the route summary can show zeros even though the database row already changed
- The development `Developer Time Machine` / `/api/dev/scheduler` is useful for scheduler-window testing, but it is not a reliable proof tool for retry eligibility because queue claiming still depends on database `NOW()` and real `available_at`

### WAHA Webhook Delivered 4x / Repeated Inbound Calls

**Symptoms:**

- One guest inbound message appears as 3-4 webhook requests to `POST /api/webhooks/waha`.
- Logs show repeated provider message IDs with duplicate handling.
- Operators suspect route loop, but message dedupe remains active.

**Actions:**

1. Check global WAHA webhook config in container:
   - `docker exec waha_server printenv | grep -E 'WHATSAPP_HOOK_URL|WHATSAPP_HOOK_EVENTS'`
2. Check session webhook config in WAHA API:
   - `curl -sS -H 'X-Api-Key: <WAHA_API_KEY>' http://localhost:3001/api/sessions/default`
3. Compare webhook URL and events from both sources.
4. Confirm event overlap:
   - If `message.any` is present, `message` is redundant and should be removed.
5. Verify app start response fields:
   - `webhooksConfigured`
   - `webhooksSkipReason` (expect `global-webhook-configured` when global webhook already covers the same target/events).

**Recovery:**

- Use one source of webhook registration for the same URL/events:
  - Option A: keep global WAHA webhook and disable session auto-config (`WAHA_AUTO_CONFIGURE_WEBHOOKS=false`).
  - Option B: remove global webhook env and keep app-managed session webhook auto-config.
- Prefer `message.any` only for inbound text-routing; do not pair it with `message` in the same subscription set.
- Restart WAHA session after configuration changes and re-check `/api/sessions/default`.
- Verify logs now show one primary route event plus explicit duplicate logs only when retry/duplicate delivery occurs.

### Duplicate `on-stay` Automation Message

**Symptoms:**

- Reservasi yang sudah pernah menerima pesan `on-stay` menerima pesan `on-stay` lagi.
- Operator baru saja mengubah status atau PMS mengirim update untuk reservasi yang sama.
- `automation_jobs` berisi lebih dari satu job `status-trigger` dengan `trigger_type = on-stay` untuk reservasi yang sama.

**Actions:**

1. Cek apakah reservasi benar-benar mengalami transisi status ke `on-stay`, bukan sekadar perubahan field lain.
2. Cek `message_logs` untuk reservation + `trigger_type = on-stay` + `status = sent`.
3. Jika ada satu atau lebih log `sent`, job berikutnya seharusnya dihentikan oleh duplicate guard sebelum call WAHA.
4. Jika job tetap mengirim, jalankan tes regresi automation dedupe.

**Recovery:**

- Pastikan runtime sudah memakai guard terbaru: realtime `on-stay` hanya enqueue pada transisi ke `on-stay`, dan worker mengecek existence log `sent` dengan query limit, bukan asumsi satu row.
- Untuk data historis yang sudah terlanjur duplicate, jangan hapus semua log `sent`; keberadaan minimal satu log `sent` diperlukan sebagai bukti pengiriman sukses.

### WAHA Inbound AI 500 (Gemini Provider Misconfiguration)

**Symptoms:**

- `POST /api/webhooks/waha` returns `500`
- Logs show `AI_APICallError` with provider failure details
- Provider response shows `statusCode: 400/401` from Gemini API endpoint

**Actions:**

1. Verify AI provider call in `lib/ai/agent.ts` uses `aiProvider(AI_MODEL)`.
2. Confirm `GEMINI_API_KEY` is set and valid in `.env.local`.
3. Confirm `GEMINI_MODEL` has no inline comments or trailing invalid characters in `.env.local`.
4. Temporarily set `AI_FEEDBACK_DEBUG=true` to inspect tool-calling step logs.
5. Re-test with one reservation in `post_stay_feedback_status='ai_followup'` and a valid inbound WAHA payload.

**Recovery:**

- Restart service after deploying the provider-path fix.
- Re-send webhook payload and verify route returns `200`.
- Confirm `message_logs` stores both inbound `received` and outbound `sent` rows for the reservation.
- If still failing, switch to another Gemini model with reliable tool-calling support and re-test.

### WAHA Inbound AI 500 (Provider Rate-Limit / 429)

**Symptoms:**

- `POST /api/webhooks/waha` sempat mengembalikan `500`.
- Log menampilkan `AI_RetryError` setelah 3 percobaan (`maxRetriesExceeded`).
- `lastError.statusCode` bernilai `429` dan response body menyebut model sedang `rate-limited upstream`.

**Actions:**

1. Cek model aktif pada env `GEMINI_MODEL`.
2. Verifikasi log detail di terminal, terutama `statusCode`, `responseBody`, dan model id.
3. Jalankan tes webhook terfokus:
   - `pnpm test tests/integration/app/api/webhooks/waha/route.test.ts`
4. Pastikan webhook route mengirim fallback reply deterministic (bukan 500) saat error provider retryable.

**Recovery:**

- Sistem kini memakai fallback otomatis untuk error AI provider retryable (termasuk 429), sehingga webhook tetap `200` dan tamu menerima pesan bahwa tim hotel akan follow-up manual.
- Jika 429 sering berulang, pindah ke model Gemini yang lebih stabil atau tingkatkan kuota billing API key.

### AI Settings Not Applied to Replies

**Symptoms:**

- Balasan AI masih memakai nama hotel default meski Settings sudah diisi.
- Simpan form AI Settings gagal dengan pesan tabel tidak tersedia.
- Log server menampilkan error terkait relasi `ai_settings`.

**Actions:**

1. Pastikan migration `20260412002000_add_ai_settings_table.sql` sudah diterapkan.
2. Verifikasi user yang mengubah settings punya role `owner` pada tenant.
3. Cek isi tabel `ai_settings` untuk `tenant_id` terkait (pastikan kolom tidak kosong semua).
4. Pastikan webhook WAHA memanggil AI dengan tenant context (fungsi `processPostStayLifecycleConversation` menerima `tenantId`).

**Recovery:**

- Jalankan migration terbaru lalu simpan ulang data AI Settings dari halaman `/settings/ai`.
- Kirim ulang pesan follow-up dari tamu untuk memicu prompt baru.
- Aktifkan `LIFECYCLE_AI_DEBUG=true` sementara untuk memeriksa step tool-calling, jumlah message context yang dikirim ke model, dan snapshot token usage bila provider mengembalikannya.

### AI Follow-up Language Mismatch / Unexpected Handoff Copy

**Symptoms:**

- Nomor non-Indonesia menerima balasan Bahasa Indonesia.
- Balasan close-out saat status `completed` tidak sesuai bahasa nomor tamu.
- AI masih membalas otomatis berulang setelah handoff `completed` seharusnya sudah aktif.
- Guest yang sama punya beberapa reservasi post-stay, tetapi webhook malah mengikuti thread `completed` lama dan mengabaikan reservation aktif yang berbeda.
- Guest yang sama punya beberapa reservation `completed`, namun sistem tetap `ignored` karena reservation pertama sudah `completed_post_stay_handoff_notified` padahal reservation lain (ID berbeda) belum pernah kirim close-out.
- AI memanggil update terlalu cepat ketika tamu baru kirim komentar tanpa rating angka.

**Actions:**

1. Verifikasi nomor tamu tersimpan dan ternormalisasi dengan benar (cek `guests.phone` + source PMS terbaru).
2. Pastikan deteksi bahasa berbasis nomor berjalan pada flow terkait:
   - `lib/automation/status-trigger.ts`
   - `lib/automation/feedback-escalation.ts`
   - `app/api/webhooks/waha/route.ts`
3. Konfirmasi status reservasi saat inbound (`post_stay_feedback_status`) apakah `completed` atau `ai_followup`.
4. Jalankan tes terfokus:
   - `pnpm test tests/integration/app/api/webhooks/waha/route.test.ts tests/unit/lib/automation/feedback-escalation.test.ts tests/unit/lib/ai/agent.test.ts`
5. Verifikasi prompt rule di `lib/ai/agent.ts`:
   - `update_guest_feedback` hanya boleh dipanggil jika rating numerik `1-5` sudah tersedia.
   - Jika tamu kirim komentar dulu, AI harus meminta rating angka terlebih dahulu.
6. Untuk kasus `completed`, cek `lifecycle_ai_sessions` (`lifecycle_stage='post-stay'`) dan pastikan:
   - `session_status='handoff'`
   - `last_action_type='completed_post_stay_handoff_notified'`
7. Jika satu nomor tamu punya lebih dari satu reservation `checked-out`, pastikan routing memilih prioritas:
   - `pending` / `ai_followup` lebih dulu
   - `completed` hanya fallback saat tidak ada reservation post-stay aktif lain
8. Untuk kasus semua reservation `completed`, verifikasi disambiguasi per reservation ID:
   - Jika reservation `completed` pertama sudah `completed_post_stay_handoff_notified`, route harus mencoba reservation `completed` lain (`id` berbeda) untuk cek apakah masih boleh kirim close-out sekali.

**Recovery:**

- Perbaiki data nomor tamu di PMS sync jika mismatch sumber data ditemukan.
- Untuk status `completed`, sistem hanya mengirim satu pesan penutup AI lalu handoff ke staf; pesan inbound berikutnya tidak di-auto-reply oleh AI.
- Jika provider retryable error (misalnya `429`) terjadi saat membuat pesan penutup `completed`, route tetap mengirim fallback deterministic dan menyimpan status handoff.
- Untuk guest dengan multi-reservation, pastikan reservation yang masih `pending`/`ai_followup` dipilih lebih dulu agar rating chat tetap bisa diterima walaupun ada reservation lain yang sudah `completed`.
- Untuk multi-reservation `completed`, reservation yang sudah notified harus tetap di-ignore, tetapi reservation `completed` lain yang belum notified wajib tetap mengirim satu pesan close-out handoff.
- Jika `429` sering berulang, pertahankan `GEMINI_MODEL=gemini-2.5-flash` dan andalkan fallback manual/deterministik yang sudah ada di webhook flow.

### Feedback Completed But Guest Points Not Increasing

**Symptoms:**

- Status feedback reservation berubah menjadi `completed`, tetapi `guests.points` tidak bertambah.
- Response web submit feedback tidak mengembalikan `rewardPoints` sesuai ekspektasi.
- Tim melihat potensi duplikasi poin saat feedback dikirim ulang.
- Balasan AI follow-up tidak menyebutkan bahwa poin dapat ditukar ke benefit layanan.

**Actions:**

1. Pastikan migration `20260417000100_add_feedback_reward_points_function.sql` sudah diterapkan.
2. Verifikasi fungsi RPC `complete_post_stay_feedback_with_reward` tersedia di database.
3. Cek logs untuk error dari `app/api/feedback/submit/route.ts` atau `lib/ai/agent.ts` saat memanggil RPC.
4. Jalankan tes terfokus:
   - `pnpm test tests/integration/app/api/feedback/submit/route.test.ts tests/unit/lib/ai/agent.test.ts`
5. Validasi data reservation target: `tenant_id`, `guest_id`, dan `post_stay_feedback_status`.
6. Validasi output tool AI setelah `update_guest_feedback` memuat info penukaran poin (welcome drink, extra bed, potongan harga / room-rate discount).

**Recovery:**

- Terapkan migration yang belum jalan lalu ulangi submit feedback.
- Jika status awal reservation sudah `completed`, sistem memang mengembalikan `rewardPoints: 0` (idempotent, tidak ada duplikasi poin).
- Jika error RPC masih muncul, rollback deployment terbaru dan lakukan verifikasi schema parity antara `supabase/schema.sql` dan migration aktif.

### Webhook Failures

**Symptoms:**

- `POST /api/webhooks/pms` returns `400`, `401`, `404`, or `5xx`
- QloApps module logs show repeated delivery attempts
- `inbound_events` is missing expected rows for real booking/status changes

**Actions:**

1. Confirm the module endpoint points to `/api/webhooks/pms`.
2. If QloApps runs in Docker and the app runs on the host, use `http://host.docker.internal:3000/api/webhooks/pms` instead of `http://localhost:3000/api/webhooks/pms`.
3. Confirm `Shared Secret` in QloApps matches `PMS_WEBHOOK_SECRET` exactly.
4. Confirm `Tenant Key` in QloApps matches `tenants.slug` exactly.
5. Inspect QloApps module logs in `modules/loyalinnwebhooksync/logs/webhook.log`.
6. Check whether real hook handlers are running with module `enabled=true`.
7. Treat `booking.test` as a connectivity/signature diagnostic only; it does not prove real order/status hooks are enabled in runtime.
8. Review app logs and `inbound_events.processing_error` for the failed event.

**Recovery:**

- Fix endpoint reachability, shared secret, tenant key, or module enabled state.
- Re-send a test event to validate transport after configuration changes.
- If real events were missed during the outage window, run reconciliation once and then return to webhook-first mode.

## UAT: QloApps webhook-first flow

Use this sequence after deployment or configuration changes:

1. Create or update a booking in QloApps.
2. Confirm the QloApps module logs one outbound webhook attempt.
3. Confirm an `inbound_events` row is created for the matching event.
4. Confirm the reservation exists locally with the correct `pms_reservation_id` / booking mapping.
5. Confirm the guest row exists or is updated.
6. Confirm downstream automation is enqueued only after the reservation write succeeds.
7. Confirm no browser auto-refresh loop is required for correctness; staff may manually refresh until push-based browser updates are added.
