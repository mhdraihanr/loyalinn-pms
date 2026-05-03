"use client";

import { Badge, Group, Tabs } from "@mantine/core";
import { IconBed, IconDoorEnter, IconToolsKitchen2 } from "@tabler/icons-react";
import {
  HousekeepingTable,
  HousekeepingRequest,
} from "@/components/operations/housekeeping-table";
import {
  RoomServiceTable,
  RoomServiceOrder,
} from "@/components/operations/room-service-table";
import {
  ArrivalRequest,
  ArrivalRequestsTable,
} from "@/components/operations/arrival-requests-table";

export function OperationsTabs({
  housekeepingData,
  roomServiceData,
  arrivalRequestsData,
}: {
  housekeepingData: HousekeepingRequest[];
  roomServiceData: RoomServiceOrder[];
  arrivalRequestsData: ArrivalRequest[];
}) {
  return (
    <Tabs defaultValue="housekeeping">
      <Tabs.List aria-label="Operations queues" mb="md">
        <Tabs.Tab value="housekeeping" leftSection={<IconBed size={16} />}>
          <Group gap={6} wrap="nowrap">
            Housekeeping
            <Badge size="xs" variant="light" color="gray">
              {housekeepingData.length}
            </Badge>
          </Group>
        </Tabs.Tab>
        <Tabs.Tab
          value="room-service"
          leftSection={<IconToolsKitchen2 size={16} />}
        >
          <Group gap={6} wrap="nowrap">
            Room Service
            <Badge size="xs" variant="light" color="gray">
              {roomServiceData.length}
            </Badge>
          </Group>
        </Tabs.Tab>
        <Tabs.Tab
          value="arrival-requests"
          leftSection={<IconDoorEnter size={16} />}
        >
          <Group gap={6} wrap="nowrap">
            Arrival Requests
            <Badge size="xs" variant="light" color="gray">
              {arrivalRequestsData.length}
            </Badge>
          </Group>
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="housekeeping">
        <HousekeepingTable initialData={housekeepingData} />
      </Tabs.Panel>

      <Tabs.Panel value="room-service">
        <RoomServiceTable initialData={roomServiceData} />
      </Tabs.Panel>

      <Tabs.Panel value="arrival-requests">
        <ArrivalRequestsTable initialData={arrivalRequestsData} />
      </Tabs.Panel>
    </Tabs>
  );
}
