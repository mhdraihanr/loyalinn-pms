import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const NEXT_PUBLIC_SUPABASE_URL = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from("reservations")
    .select("pms_reservation_id, guests(name, phone, country)")
    .in("pms_reservation_id", ["O8-R6", "O7-R11"]);
  console.log(JSON.stringify(data, null, 2));


  const logs = await supabase.from("message_logs").select("trigger_type, template_language_code, phone").order("created_at", { ascending: false }).limit(5);
  console.log(JSON.stringify(logs.data, null, 2));
}

main();
