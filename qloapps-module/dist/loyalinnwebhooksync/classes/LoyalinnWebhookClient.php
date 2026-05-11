<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

require_once dirname(__FILE__) . '/LoyalinnWebhookSigner.php';
require_once dirname(__FILE__) . '/LoyalinnWebhookLogger.php';

class LoyalinnWebhookClient
{
    public static function send($endpoint, $tenantKey, $secret, $eventType, $payload, $timeoutSeconds)
    {
        if (empty($endpoint) || empty($tenantKey) || empty($secret)) {
            LoyalinnWebhookLogger::write('warning', 'Missing webhook configuration', array(
                'endpoint' => (bool) $endpoint,
                'tenant_key' => (bool) $tenantKey,
                'secret' => (bool) $secret,
                'event_type' => $eventType,
            ));

            return array(
                'ok' => false,
                'status_code' => 0,
                'response_body' => 'Missing webhook configuration',
            );
        }

        $payload['tenant_key'] = $tenantKey;
        $payload['event_type'] = $eventType;
        $payload['occurred_at'] = isset($payload['occurred_at']) ? $payload['occurred_at'] : gmdate('c');
        $payload['event_id'] = isset($payload['event_id']) ? $payload['event_id'] : self::buildEventId($eventType, $payload);

        $rawBody = json_encode($payload);
        $timestamp = (string) time();
        $signature = LoyalinnWebhookSigner::sign($secret, $timestamp, $rawBody);

        $headers = array(
            'Content-Type: application/json',
            'X-PMS-Source: qloapps',
            'X-PMS-Timestamp: ' . $timestamp,
            'X-PMS-Signature: ' . $signature,
        );

        if (!function_exists('curl_init')) {
            LoyalinnWebhookLogger::write('error', 'cURL extension unavailable', array(
                'event_type' => $eventType,
                'event_id' => $payload['event_id'],
            ));

            return array(
                'ok' => false,
                'status_code' => 0,
                'response_body' => 'cURL extension unavailable',
            );
        }

        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, max(1, (int) $timeoutSeconds));
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, max(1, (int) $timeoutSeconds));

        $responseBody = curl_exec($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        $ok = $responseBody !== false && $statusCode >= 200 && $statusCode < 300;

        LoyalinnWebhookLogger::write($ok ? 'info' : 'error', 'Webhook delivery attempted', array(
            'endpoint' => $endpoint,
            'event_type' => $eventType,
            'event_id' => $payload['event_id'],
            'id_order' => isset($payload['id_order']) ? $payload['id_order'] : null,
            'id_room_booking' => isset($payload['id_room_booking']) ? $payload['id_room_booking'] : null,
            'order_status_code' => isset($payload['order_status_code']) ? $payload['order_status_code'] : null,
            'room_status_code' => isset($payload['room_status_code']) ? $payload['room_status_code'] : null,
            'status_code' => $statusCode,
            'curl_error' => $curlError,
            'response_body' => is_string($responseBody) ? substr($responseBody, 0, 1000) : '',
        ));

        return array(
            'ok' => $ok,
            'status_code' => $statusCode,
            'response_body' => $responseBody,
            'curl_error' => $curlError,
            'payload' => $payload,
        );
    }

    protected static function buildEventId($eventType, $payload)
    {
        $idOrder = isset($payload['id_order']) ? (string) $payload['id_order'] : 'unknown';
        $statusCode = isset($payload['room_status_code'])
            ? (string) $payload['room_status_code']
            : (isset($payload['order_status_code'])
                ? (string) $payload['order_status_code']
                : (isset($payload['status_code']) ? (string) $payload['status_code'] : 'na'));
        $idRoomBooking = isset($payload['id_room_booking']) ? (string) $payload['id_room_booking'] : 'na';
        $occurredAt = isset($payload['occurred_at']) ? (string) $payload['occurred_at'] : gmdate('c');

        return sprintf('qloapps-%s-%s-%s-%s-%s', $eventType, $idOrder, $idRoomBooking, $statusCode, md5($occurredAt));
    }
}
