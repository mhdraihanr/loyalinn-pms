"use client";

import { Tabs, TabsList, TabsTab } from "@mantine/core";
import { useRouter } from "next/navigation";
import {
  IconClipboardList,
  IconCalendarEvent,
  IconDoorEnter,
  IconDoorExit,
} from "@tabler/icons-react";

export function ReservationsTabs({ currentStatus }: { currentStatus: string }) {
  const router = useRouter();

  return (
    <Tabs
      value={currentStatus}
      onChange={(val) => router.push(`/reservations?status=${val}`)}
    >
      <TabsList mb="md">
        <TabsTab value="all" leftSection={<IconClipboardList size={16} />}>
          All
        </TabsTab>
        <TabsTab
          value="pre-arrival"
          leftSection={<IconCalendarEvent size={16} />}
        >
          Pre-Arrival
        </TabsTab>
        <TabsTab value="on-stay" leftSection={<IconDoorEnter size={16} />}>
          On Stay
        </TabsTab>
        <TabsTab value="checked-out" leftSection={<IconDoorExit size={16} />}>
          Checked Out
        </TabsTab>
      </TabsList>
    </Tabs>
  );
}
