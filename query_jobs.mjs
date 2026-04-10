import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const NEXT_PUBLIC_SUPABASE_URL = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_SERVICE_ROLE_KEY = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from("automation_jobs")
    .select("status, id, payload, trigger_type, error_message, last_error_category")
    .order("created_at", { ascending: false }).limit(10);
  console.log(data);
}

main();
