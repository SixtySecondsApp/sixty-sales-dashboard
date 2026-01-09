-- Add user_preferences table for user-specific settings and state
-- Includes recording setup wizard completion tracking

create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Recording setup wizard tracking
  recording_setup_completed_at timestamp with time zone,

  -- Timestamps
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table user_preferences enable row level security;

-- RLS Policies
-- Users can read their own preferences
create policy "Users can read own preferences"
  on user_preferences
  for select
  using (auth.uid() = user_id);

-- Users can insert their own preferences
create policy "Users can insert own preferences"
  on user_preferences
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own preferences
create policy "Users can update own preferences"
  on user_preferences
  for update
  using (auth.uid() = user_id);

-- Add updated_at trigger
create trigger update_user_preferences_updated_at
  before update on user_preferences
  for each row
  execute function update_updated_at_column();

-- Add helpful comment
comment on table user_preferences is 'User-specific preferences and state tracking';
comment on column user_preferences.recording_setup_completed_at is 'Timestamp when the user completed the recording setup wizard';
