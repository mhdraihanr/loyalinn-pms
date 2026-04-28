import { Box, Title } from "@mantine/core";
import { OperationsTabs } from "@/components/operations/operations-tabs";
import type { ArrivalRequest } from "@/components/operations/arrival-requests-table";
import type { HousekeepingRequest } from "@/components/operations/housekeeping-table";
import type { RoomServiceOrder } from "@/components/operations/room-service-table";
import {
  getArrivalRequests,
  getHousekeepingRequests,
  getRoomServiceOrders,
} from "@/lib/data/operations";
import { requireUserTenant } from "@/lib/auth/tenant";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const { tenantId } = await requireUserTenant();
  
  const [housekeepingData, roomServiceData, arrivalRequestsData] = await Promise.all([
    getHousekeepingRequests(tenantId),
    getRoomServiceOrders(tenantId),
    getArrivalRequests(tenantId),
  ]);

  return (
    <Box>
      <Title order={2} mb="md">
        Operations Dashboard
      </Title>

      <OperationsTabs 
        housekeepingData={housekeepingData as unknown as HousekeepingRequest[]} 
        roomServiceData={roomServiceData as unknown as RoomServiceOrder[]} 
        arrivalRequestsData={arrivalRequestsData as unknown as ArrivalRequest[]}
      />
    </Box>
  );
}
