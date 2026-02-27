# Supabase Database Setup Instructions

## Steps to Set Up Your Database:

### 1. Open Supabase Dashboard
Go to your project: https://supabase.com/dashboard/project/wimnhgxdflrogyinocpz

### 2. Navigate to SQL Editor
Click on "SQL Editor" in the left sidebar

### 3. Create the Database Schema
1. Click "New query"
2. Copy the ENTIRE contents of `/supabase/schema.sql`
3. Paste it into the SQL editor
4. Click "Run" (or press Cmd/Ctrl + Enter)

You should see green success messages for each table created.

### 4. Verify Tables Were Created
1. Go to "Table Editor" in the left sidebar
2. You should see these tables:
   - users
   - user_profiles
   - soul_seeds
   - memories
   - earned_traits
   - artifacts
   - analytics_events

### 5. Test the Integration
The app is now connected to Supabase! When users:
- Create their Soul Seed → Saved to Supabase
- Answer questions → Responses stored in memories table
- Unlock traits → Tracked in earned_traits table
- Get flagged for bad behavior → Stored in soul_seeds

### 6. View Your Data
- Go to "Table Editor" to see all stored data
- Use "SQL Editor" to run queries like:
  ```sql
  -- See all users
  SELECT * FROM users;
  
  -- See all soul seeds with their users
  SELECT s.*, u.twitter_handle 
  FROM soul_seeds s 
  JOIN users u ON s.user_id = u.id;
  
  -- See all memories with analysis
  SELECT * FROM memories 
  WHERE analysis IS NOT NULL;
  ```

### 7. Important Notes
- All data is public for now (we'll add auth later)
- The database automatically tracks created/updated timestamps
- UUIDs are auto-generated for all IDs
- Foreign keys ensure data integrity

### Next Steps
Once the schema is set up, the app will automatically:
1. Create users when they first use the app
2. Save all Soul Seed data to the cloud
3. Track analytics events
4. Store AI analysis of responses

No additional configuration needed - just run the SQL and you're done! 