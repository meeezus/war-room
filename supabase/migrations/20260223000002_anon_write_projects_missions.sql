-- Allow anon role to insert/update projects and missions (internal tool, no auth)
create policy "anon_insert" on projects for insert with check (true);
create policy "anon_update" on projects for update using (true);

create policy "anon_insert" on missions for insert with check (true);
create policy "anon_update" on missions for update using (true);
