import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
  const { data: guests } = await supabase.from('guests').select('id').limit(1);
  const guest_id = guests[0].id;
  
  const { data, error } = await supabase.from('reservations').upsert({
    tenant_id: '2eeca5e3-07a2-4e93-89ce-9f9f67f95b8e',
    guest_id: guest_id,
    pms_reservation_id: 'upsert-test',
    status: 'pre-arrival',
    check_in_date: '2024-01-01',
    check_out_date: '2024-01-02',
    room_number: '100'
  }, { onConflict: 'tenant_id,pms_reservation_id' }).select();
  
  console.log("Upsert result:", data, error);
}

check();
