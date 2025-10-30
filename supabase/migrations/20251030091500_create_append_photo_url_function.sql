-- Migration: Create function to append photo URLs to inspection_results.photo_urls

create or replace function public.append_photo_url(
  session_id_input uuid,
  photo_url_input text
)
returns void as $$
begin
  update public.inspection_results
  set photo_urls = coalesce(photo_urls, '[]'::jsonb) || to_jsonb(photo_url_input)
  where session_id = session_id_input;
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.append_photo_url(uuid, text) to anon, authenticated, service_role;

-- Refresh schema cache
notify pgrst, 'reload schema';
