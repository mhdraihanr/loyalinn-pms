<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

class LoyalinnWebhookSigner
{
    public static function sign($secret, $timestamp, $rawBody)
    {
        return hash_hmac('sha256', $timestamp . '.' . $rawBody, (string) $secret);
    }
}
