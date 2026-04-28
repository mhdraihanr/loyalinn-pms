"use client";

import { Tabs } from "@mantine/core";
import { HousekeepingTable, HousekeepingRequest } from "@/components/operations/housekeeping-table";
import { RoomServiceTable, RoomServiceOrder } from "@/components/operations/room-service-table";
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
      <Tabs.List mb="md">
        <Tabs.Tab value="housekeeping">Housekeeping</Tabs.Tab>
        <Tabs.Tab value="room-service">Room Service</Tabs.Tab>
        <Tabs.Tab value="arrival-requests">Arrival Requests</Tabs.Tab>
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
