-- =====================================================================
-- Yorkshire Adoption Home - Realtime publication
-- =====================================================================
-- Realtime respects RLS, so adding a table here does not widen access:
-- a visitor still only receives events for rows their SELECT policy
-- would have returned.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['messages', 'conversations', 'applications'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;   -- already in the publication
      when undefined_object then         -- publication does not exist yet
        execute 'create publication supabase_realtime';
        execute format('alter publication supabase_realtime add table public.%I', t);
    end;
  end loop;
end $$;

-- Realtime UPDATE/DELETE payloads only carry the primary key unless the
-- table has REPLICA IDENTITY FULL. The messenger needs the whole row.
alter table public.messages      replica identity full;
alter table public.conversations replica identity full;
