-- Migration: Enable Realtime for Operations Tables
-- Description: Adds room_service_orders and housekeeping_requests to the supabase_realtime publication

ALTER PUBLICATION supabase_realtime ADD TABLE room_service_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE housekeeping_requests;
