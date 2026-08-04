"use client";

import { useRouter } from "next/navigation";
import { Badge, Group, Tabs } from "@mantine/core";
import { IconBed, IconDoorEnter, IconMessageCircle, IconToolsKitchen2 } from "@tabler/icons-react";
import { ArrivalRequestsTable } from "@/components/operations/arrival-requests-table";
import type { ArrivalRequest } from "@/components/operations/arrival-requests-table";
import { HandoffChatDrawer } from "@/components/operations/handoff-chat-drawer";
import { HousekeepingTable } from "@/components/operations/housekeeping-table";
import type { HousekeepingRequest } from "@/components/operations/housekeeping-table";
import { HumanHandoffsTable } from "@/components/operations/human-handoffs-table";
import { RoomServiceTable } from "@/components/operations/room-service-table";
import type { RoomServiceOrder } from "@/components/operations/room-service-table";
import type { HandoffTranscriptMessage, HumanHandoff } from "@/lib/data/operations";

const TAB_VALUES = new Set([
  "housekeeping",
  "room-service",
  "arrival-requests",
  "human-handoffs",
]);

type OperationsTabsProps = {
  housekeepingData: HousekeepingRequest[];
  roomServiceData: RoomServiceOrder[];
  arrivalRequestsData: ArrivalRequest[];
  humanHandoffsData: HumanHandoff[];
  currentTab: string;
  selectedHandoff: HumanHandoff | null;
  selectedHandoffTranscript: HandoffTranscriptMessage[];
};

export function OperationsTabs({
  housekeepingData,
  roomServiceData,
  arrivalRequestsData,
  humanHandoffsData,
  currentTab,
  selectedHandoff,
  selectedHandoffTranscript,
}: OperationsTabsProps) {
  const router = useRouter();
  const activeHandoffs = humanHandoffsData.filter(
    (handoff) => handoff.session_status === "handoff" && handoff.needs_human_follow_up,
  ).length;
  const value = TAB_VALUES.has(currentTab) ? currentTab : "housekeeping";

  const selectTab = (nextTab: string | null) => {
    const tab = nextTab && TAB_VALUES.has(nextTab) ? nextTab : "housekeeping";
    router.push(`/operations?tab=${tab}`);
  };

  return (
    <>
      <Tabs value={value} onChange={selectTab}>
        <Tabs.List aria-label="Operations queues" mb="md">
          <Tabs.Tab value="housekeeping" leftSection={<IconBed size={16} />}>
            <Group gap={6} wrap="nowrap">Housekeeping <Badge size="xs" variant="light" color="gray">{housekeepingData.length}</Badge></Group>
          </Tabs.Tab>
          <Tabs.Tab value="room-service" leftSection={<IconToolsKitchen2 size={16} />}>
            <Group gap={6} wrap="nowrap">Room Service <Badge size="xs" variant="light" color="gray">{roomServiceData.length}</Badge></Group>
          </Tabs.Tab>
          <Tabs.Tab value="arrival-requests" leftSection={<IconDoorEnter size={16} />}>
            <Group gap={6} wrap="nowrap">Arrival Requests <Badge size="xs" variant="light" color="gray">{arrivalRequestsData.length}</Badge></Group>
          </Tabs.Tab>
          <Tabs.Tab value="human-handoffs" leftSection={<IconMessageCircle size={16} />}>
            <Group gap={6} wrap="nowrap">Human Handoffs <Badge size="xs" variant="light" color="violet">{activeHandoffs}</Badge></Group>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="housekeeping"><HousekeepingTable initialData={housekeepingData} /></Tabs.Panel>
        <Tabs.Panel value="room-service"><RoomServiceTable initialData={roomServiceData} /></Tabs.Panel>
        <Tabs.Panel value="arrival-requests"><ArrivalRequestsTable initialData={arrivalRequestsData} /></Tabs.Panel>
        <Tabs.Panel value="human-handoffs"><HumanHandoffsTable initialData={humanHandoffsData} /></Tabs.Panel>
      </Tabs>
      <HandoffChatDrawer handoff={selectedHandoff} transcript={selectedHandoffTranscript} />
    </>
  );
}
