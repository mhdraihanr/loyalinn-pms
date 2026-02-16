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
- Manual sync available via admin panel
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
