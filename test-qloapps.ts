import { QloAppsAdapter } from "./lib/pms/qloapps-adapter";

async function testQloApps() {
  const adapter = new QloAppsAdapter();
  adapter.init(
    { api_key: "CL9UMY7EJW5D51VCTVQQV2UHJ2GV88FG" }, // Standard dev key from docs
    "http://localhost:8080",
  );

  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const startDate = lastWeek.toISOString().split("T")[0];
  const endDate = nextWeek.toISOString().split("T")[0];

  console.log(`Pulling reservations for ${startDate} to ${endDate}...`);
  try {
    const data = await adapter.pullReservations(startDate, endDate);
    console.log("Reservations found:", data.length);
    console.log(JSON.stringify(data, null, 2));

    if (data.length > 0) {
      console.log(`\nPulling Guest Info for ID: ${data[0].pms_guest_id}...`);
      const guestData = await adapter.pullGuest(data[0].pms_guest_id);
      console.log(JSON.stringify(guestData, null, 2));
    }
  } catch (e) {
    console.error("Test failed:", e);
  }
}

testQloApps();
