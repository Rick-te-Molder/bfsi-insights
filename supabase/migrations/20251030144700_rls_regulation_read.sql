
  create policy "anon_read"
  on "public"."regulation"
  as permissive
  for select
  to anon
using (true);



  create policy "auth_read"
  on "public"."regulation"
  as permissive
  for select
  to authenticated
using (true);



