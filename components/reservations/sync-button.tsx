"use client";

import { useTransition } from "react";
import { Button } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { triggerManualSync } from "@/lib/pms/sync-action";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();

  const handleSync = () => {
    startTransition(async () => {
      const result = await triggerManualSync();

      if (result.error) {
        notifications.show({
          title: "Sync Failed",
          message: result.error,
          color: "red",
        });
      } else {
        notifications.show({
          title: "Sync Successful",
          message: result.message,
          color: "green",
        });
      }
    });
  };

  return (
    <Button
      variant="light"
      leftSection={<IconRefresh size={16} />}
      loading={isPending}
      onClick={handleSync}
    >
      Sync PMS
    </Button>
  );
}
