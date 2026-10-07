drop policy if exists "Users can view their own bill files"
  on storage.objects;

create policy "Users can view their own bill files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'bill-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
