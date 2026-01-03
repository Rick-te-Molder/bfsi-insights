-- Allow authenticated users to update kb_publication
-- Required for admin publications edit page

-- Add update policy for authenticated users
CREATE POLICY "kb_publication_update_authenticated" 
  ON kb_publication 
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Grant UPDATE permission to authenticated role
GRANT UPDATE ON kb_publication TO authenticated;
