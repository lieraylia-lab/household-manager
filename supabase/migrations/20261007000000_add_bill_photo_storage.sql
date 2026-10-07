alter table public.bills
  add column if not exists file_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'bill-photos',
  'bill-photos',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can view their own bill files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bill-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload their own bill files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bill-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own bill files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'bill-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
