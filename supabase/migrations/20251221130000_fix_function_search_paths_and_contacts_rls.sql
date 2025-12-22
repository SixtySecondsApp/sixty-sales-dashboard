-- Fix function search_path issues and contacts RLS

-- Fix calculate_deal_total_value function (was SET search_path TO '')
CREATE OR REPLACE FUNCTION public.calculate_deal_total_value(p_one_off_revenue numeric, p_monthly_mrr numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN COALESCE(p_one_off_revenue, 0) + (COALESCE(p_monthly_mrr, 0) * 3);
END;
$function$;

-- Fix calculate_deal_annual_value function (was SET search_path TO '')
CREATE OR REPLACE FUNCTION public.calculate_deal_annual_value(p_one_off_revenue numeric, p_monthly_mrr numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN COALESCE(p_one_off_revenue, 0) + (COALESCE(p_monthly_mrr, 0) * 12);
END;
$function$;

-- Fix update_deal_revenue_calculations trigger function (was SET search_path TO '')
-- This is the ROOT CAUSE - it calls the calculate functions without public. prefix
CREATE OR REPLACE FUNCTION public.update_deal_revenue_calculations()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-calculate total deal value
  NEW.value := calculate_deal_total_value(NEW.one_off_revenue, NEW.monthly_mrr);

  -- Auto-calculate annual value
  NEW.annual_value := calculate_deal_annual_value(NEW.one_off_revenue, NEW.monthly_mrr);

  RETURN NEW;
END;
$function$;

-- Fix contacts INSERT policy to allow authenticated users
DROP POLICY IF EXISTS "contacts_insert" ON contacts;

CREATE POLICY "contacts_insert" ON contacts
  FOR INSERT
  WITH CHECK (
    is_service_role()
    OR auth.uid() IS NOT NULL  -- Any authenticated user can insert
  );
