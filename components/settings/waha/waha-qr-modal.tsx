"use client";

import { Modal, Image, Text, Loader, Center } from "@mantine/core";

interface WahaQrModalProps {
  opened: boolean;
  onClose: () => void;
  qrCode: string | null;
}

export function WahaQrModal({ opened, onClose, qrCode }: WahaQrModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Connect WhatsApp" centered>
      <div className="flex flex-col items-center justify-center p-4">
        {!qrCode ? (
          <Center className="h-48 flex-col gap-4">
            <Loader size="lg" />
            <Text c="dimmed">Loading QR Code...</Text>
          </Center>
        ) : (
          <div className="text-center">
            <Image
              src={qrCode}
              alt="WhatsApp QR Code"
              className="w-64 h-64 mx-auto mb-4"
            />
            <Text size="sm" c="dimmed">
              Open WhatsApp on your phone, go to Settings &gt; Linked Devices,
              and scan this QR code.
            </Text>
          </div>
        )}
      </div>
    </Modal>
  );
}
