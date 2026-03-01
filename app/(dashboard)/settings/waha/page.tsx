"use client";

import { useEffect, useState } from "react";
import { Card, Text, Button, Badge, Group, Stack, Alert } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBrandWhatsapp, IconAlertCircle } from "@tabler/icons-react";
import { WahaQrModal } from "@/components/settings/waha/waha-qr-modal";

export default function WahaSettingsPage() {
  const [status, setStatus] = useState<string>("LOADING");
  const [phoneInfo, setPhoneInfo] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/waha/status");
      if (!res.ok) throw new Error("Failed to fetch API status");

      const data = await res.json();
      setStatus(data.status || "STOPPED");
      setPhoneInfo(data.me || null);

      if (data.status === "SCAN_QR_CODE" && !qrCode) {
        setIsModalOpen(true);
        fetchQrCode();
      } else if (data.status === "WORKING") {
        setIsModalOpen(false);
      }
    } catch (error) {
      setStatus("ERROR");
    }
  };

  const fetchQrCode = async () => {
    try {
      const res = await fetch("/api/waha/qr");
      const data = await res.json();

      // Depending on WAHA API, might need to parse. Assuming base64 data URI or raw image.
      if (data && data.qr) {
        setQrCode(data.qr);
      } else if (data && data.image) {
        setQrCode(data.image);
      } else if (data && data.mimetype && data.data) {
        setQrCode(`data:${data.mimetype};base64,${data.data}`);
      } else if (typeof data === "string" && data.startsWith("<svg")) {
        setQrCode(`data:image/svg+xml;utf8,${encodeURIComponent(data)}`);
      } else {
        // fallback to standard base64 if returned generically
        setQrCode(null);
      }
    } catch (error) {
      console.error("Failed to load QR code", error);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [qrCode]);

  const handleConnect = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/waha/start", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start session");

      notifications.show({
        title: "Connecting",
        message: "Starting WhatsApp session...",
        color: "blue",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to start session.",
        color: "red",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsActionLoading(true);
    try {
      const res = await fetch("/api/waha/logout", { method: "POST" });
      if (!res.ok) throw new Error("Failed to logout session");

      notifications.show({
        title: "Disconnected",
        message: "WhatsApp session logged out.",
        color: "gray",
      });
      setStatus("STOPPED");
      setPhoneInfo(null);
      setQrCode(null);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to disconnect session.",
        color: "red",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          WhatsApp Integration
        </h1>
        <p className="text-muted-foreground">
          Manage your automated WhatsApp business connection.
        </p>
      </div>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="sm">
              <IconBrandWhatsapp
                size={24}
                color={status === "WORKING" ? "green" : "gray"}
              />
              <Text fw={500} size="lg">
                Session Status
              </Text>
            </Group>

            <Badge
              color={
                status === "WORKING"
                  ? "green"
                  : status === "SCAN_QR_CODE"
                    ? "yellow"
                    : status === "STARTING"
                      ? "blue"
                      : status === "LOADING"
                        ? "gray"
                        : "red"
              }
              variant="light"
            >
              {status}
            </Badge>
          </Group>

          <Text c="dimmed" size="sm">
            {status === "WORKING"
              ? "Your WhatsApp is connected and ready to send automated messages."
              : status === "SCAN_QR_CODE"
                ? "Waiting for QR Code scan to complete connection."
                : status === "STOPPED"
                  ? "WhatsApp is disconnected. Click Connect to start."
                  : "Checking status..."}
          </Text>

          {phoneInfo && (
            <div className="bg-gray-50 p-3 rounded-md border text-sm mt-2">
              <Text fw={500}>
                Connected Number: +
                {phoneInfo.user?.split(":")[0] ||
                  phoneInfo.id?.split("@")[0] ||
                  "Unknown"}
              </Text>
            </div>
          )}

          {status === "ERROR" && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Connection Error"
              color="red"
            >
              Could not communicate with the WAHA server. Please check your
              global WAHA_BASE_URL and WAHA_API_KEY environment variables, or
              ensure the WAHA server is running.
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            {status === "WORKING" ? (
              <Button
                color="red"
                variant="outline"
                onClick={handleDisconnect}
                loading={isActionLoading}
              >
                Disconnect
              </Button>
            ) : status === "SCAN_QR_CODE" ? (
              <Button color="blue" onClick={() => setIsModalOpen(true)}>
                Show QR Code
              </Button>
            ) : status === "STOPPED" || status === "ERROR" ? (
              <Button
                color="green"
                onClick={handleConnect}
                loading={isActionLoading}
              >
                Connect WhatsApp
              </Button>
            ) : status === "LOADING" ? (
              <Button color="green" loading={true}>
                Connect WhatsApp
              </Button>
            ) : null}
          </Group>
        </Stack>
      </Card>

      <WahaQrModal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        qrCode={qrCode}
      />
    </div>
  );
}
