import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

const { error } = await supabase.from('reservations').upsert({
  tenant_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  guest_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  pms_reservation_id: 'test',
  status: 'pre-arrival',
  check_in_date: '2024-01-01',
  check_out_date: '2024-01-02',
}, { onConflict: 'tenant_id,pms_reservation_id' });
console.log(error);
