-- =====================================================================
-- 0009_fix_certificates_rpc.sql
-- Public RPC to retrieve approved adoption certificates for clients
-- =====================================================================

create or replace function public.get_approval_certificate(lookup_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.applications%rowtype;
begin
  if lookup_key is null or trim(lookup_key) = '' then
    return null;
  end if;

  -- 1. Try matching by UUID id if valid uuid
  if lookup_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_app
    from public.applications
    where id = lookup_key::uuid;
  end if;

  -- 2. If not found or not uuid, try matching by reference
  if v_app.id is null then
    select * into v_app
    from public.applications
    where lower(reference) = lower(trim(lookup_key));
  end if;

  -- Return null if not found
  if v_app.id is null then
    return null;
  end if;

  -- Return certificate data
  return jsonb_build_object(
    'id', v_app.id,
    'reference', v_app.reference,
    'status', v_app.status,
    'first_name', v_app.first_name,
    'last_name', v_app.last_name,
    'email', v_app.email,
    'phone', v_app.phone,
    'city', v_app.city,
    'country', v_app.country,
    'puppy_name', v_app.puppy_name,
    'notification_preference', v_app.notification_preference,
    'applicant_whatsapp', v_app.applicant_whatsapp,
    'score', v_app.score,
    'submitted_at', v_app.submitted_at,
    'reviewed_at', v_app.reviewed_at
  );
end;
$$;

grant execute on function public.get_approval_certificate(text) to anon, authenticated;
