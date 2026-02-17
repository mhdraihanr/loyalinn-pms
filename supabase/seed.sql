-- Demo data for testing

-- Note: In production, users will sign up via Supabase Auth
-- and tenants will be auto-created via onboarding flow

-- Create a demo user (you'll need to create this user in Supabase Auth first)
-- Then insert tenant with that user_id

-- Example tenant (replace with actual user_id from auth.users)
-- INSERT INTO tenants (user_id, name, slug) VALUES 
--   ('00000000-0000-0000-0000-000000000000', 'Demo Hotel', 'demo-hotel');

-- Message templates for demo tenant
-- INSERT INTO message_templates (tenant_id, name, trigger, content) VALUES
--   ((SELECT id FROM tenants WHERE slug = 'demo-hotel'), 'Pre-arrival Welcome', 'pre-arrival', 'Hi {{guest_name}}, welcome to {{hotel_name}}! Your check-in is on {{check_in_date}}.'),
--   ((SELECT id FROM tenants WHERE slug = 'demo-hotel'), 'On-stay Check', 'on-stay', 'Hi {{guest_name}}, how is your stay? Let us know if you need anything!'),
--   ((SELECT id FROM tenants WHERE slug = 'demo-hotel'), 'Post-stay Thank You', 'post-stay', 'Thank you for staying with us, {{guest_name}}! We hope to see you again soon.');yed your stay. Please share your feedback!', 
   true);
