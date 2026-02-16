-- Insert demo tenant
INSERT INTO tenants (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Hotel', 'demo-hotel');

-- Note: tenant_users will be populated when users sign up
-- The following is just for reference during development

-- Insert demo message templates
INSERT INTO message_templates (tenant_id, name, trigger, content, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Pre-arrival Welcome', 'pre-arrival', 
   'Hello {{guestName}}! Welcome to our hotel. Your room {{roomNumber}} will be ready on {{checkInDate}}. We look forward to seeing you!', 
   true),
  ('00000000-0000-0000-0000-000000000001', 'Check-in Confirmation', 'on-stay', 
   'Welcome {{guestName}}! You are now checked in to room {{roomNumber}}. Enjoy your stay!', 
   true),
  ('00000000-0000-0000-0000-000000000001', 'Post-stay Feedback', 'post-stay', 
   'Thank you for staying with us, {{guestName}}! We hope you enjoyed your stay. Please share your feedback!', 
   true);
