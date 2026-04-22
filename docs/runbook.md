# Operational Runbook

## Overview

This runbook provides procedures for monitoring, troubleshooting, and responding to incidents in the Hotel PMS Integration & WhatsApp Automation system.

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

- Webhooks will retry automatically
- Trigger `GET /api/cron/pms-sync` with the cron bearer token if an immediate pull is required
- Check for data gaps after recovery

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
- Reconnect WhatsApp session via QR
- Check dead-letter queue for unrecoverable failures

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
- Aktifkan `LIFECYCLE_AI_DEBUG=true` sementara untuk memeriksa step tool-calling dan ringkasan AI.

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
- Jika `429` sering berulang, isi `GEMINI_FALLBACK_MODEL` agar agent otomatis mencoba model cadangan sebelum masuk fallback manual.

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

- Duplicate events processed
- Missing reservation updates
- High error rate in `inbound_events`

**Actions:**

1. Check webhook signature validation
2. Verify `PMS_WEBHOOK_SECRET` is correct
3. Review `inbound_events` for duplicate `event_id`
4. Check idempotency logic
5. Validate event payload schema

**Recovery:**

- Idempotency prevents duplicate processing
- Replay failed events manually if needed
- Update webhook secret if compromised

### Database Issues

**Symptoms:**

- Slow queries
- Connection timeouts
- RLS policy errors

**Actions:**

1. Check Supabase dashboard for performance
2. Review slow query logs
3. Verify RLS policies are correct
4. Check connection pool settings
5. Scale database if needed

**Recovery:**

- Optimize slow queries with indexes
- Review and fix RLS policies
- Increase connection pool size
- Upgrade database tier if necessary

## Alert Thresholds

### Critical Alerts (Immediate Response)

- Message delivery failure rate > 10%
- Webhook processing failure rate > 5%
- Database connection errors
- Authentication system down

### Warning Alerts (Monitor)

- Message delivery failure rate > 5%
- Slow query time > 1s
- High retry queue depth
- Session refresh failures

## On-Call Actions

1. **Acknowledge Alert**: Respond within 5 minutes
2. **Assess Impact**: Check affected tenants
3. **Follow Runbook**: Use procedures above
4. **Communicate**: Update status page
5. **Resolve**: Fix root cause
6. **Post-Mortem**: Document incident

## Escalation

- **Level 1**: On-call engineer
- **Level 2**: Team lead
- **Level 3**: CTO / Infrastructure team

## Maintenance Windows

- **Scheduled**: Sundays 2-4 AM UTC
- **Emergency**: Communicate 1 hour in advance
- **Database Migrations**: During scheduled window only

## Backup and Recovery

- **Database**: Automated daily backups via Supabase
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 24 hours

## Contact Information

- **Supabase Support**: support@supabase.com
- **WAHA Support**: [GitHub Issues](https://github.com/devlikeapro/waha)
- **PMS Support**: [Vendor-specific]
