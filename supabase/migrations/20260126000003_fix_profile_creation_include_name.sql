-- Migration: Fix profile creation to include first_name and last_name
-- Problem: The auto_create_profile_on_auth_signup trigger was creating profiles without name fields
-- This caused "Unknown User" display in team members even though users entered their names
-- Solution: Update the trigger function to extract first_name and last_name from auth metadata

-- Update the function to include name fields from auth metadata
CREATE OR REPLACE FUNCTION public.create_profile_on_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if it doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (
      id,
      email,
      first_name,
      last_name,
      profile_status,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
      'active',
      NOW(),
      NOW()
    ) ON CONFLICT (id) DO NOTHING;

    RAISE LOG '[create_profile_on_auth_user_created] Created profile for user: % with name: % %',
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'N/A'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'N/A');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the comment
COMMENT ON FUNCTION public.create_profile_on_auth_user_created() IS 'Automatically creates a profile in public.profiles when a new auth user is created. Extracts first_name and last_name from auth metadata. This ensures profiles always exist with proper data and bypasses RLS issues during signup.';
