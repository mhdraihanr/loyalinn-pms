<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

class LoyalinnWebhookLogger
{
    const LOG_DIR = '/logs';
    const LOG_FILE = 'webhook.log';

    public static function write($level, $message, $context = array())
    {
        $moduleDir = dirname(dirname(__FILE__));
        $logDir = $moduleDir . self::LOG_DIR;

        if (!is_dir($logDir)) {
            @mkdir($logDir, 0755, true);
        }

        $line = sprintf(
            "[%s] %s %s %s\n",
            date('c'),
            strtoupper((string) $level),
            (string) $message,
            !empty($context) ? json_encode($context) : ''
        );

        @file_put_contents($logDir . DIRECTORY_SEPARATOR . self::LOG_FILE, $line, FILE_APPEND);
    }
}
