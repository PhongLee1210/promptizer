create extension if not exists pgcrypto;

create type prompt_model as enum ('chatgpt', 'claude', 'gemini');

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table category (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table tag (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table prompt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  model prompt_model,
  example_usage text,
  example_output_type text check (example_output_type in ('text', 'image')),
  example_output_text text,
  example_output_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (category_id, user_id) references category (id, user_id) on delete set null (category_id)
);

create index prompt_user_updated_idx on prompt (user_id, updated_at desc);
create index prompt_category_idx on prompt (category_id);

create trigger prompt_set_updated_at before update on prompt
  for each row execute function set_updated_at();

create table prompt_version (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references prompt (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  body text not null,
  created_at timestamptz not null default now(),
  unique (prompt_id, version_number)
);

create table prompt_tag (
  prompt_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (prompt_id, tag_id),
  foreign key (prompt_id, user_id) references prompt (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references tag (id, user_id) on delete cascade
);

create index prompt_tag_tag_idx on prompt_tag (tag_id);

create view prompt_latest_version
with (security_invoker = true) as
select distinct on (prompt_id) prompt_id, version_number, body, created_at
from prompt_version
order by prompt_id, version_number desc;

alter table category enable row level security;
alter table tag enable row level security;
alter table prompt enable row level security;
alter table prompt_version enable row level security;
alter table prompt_tag enable row level security;

create policy category_owner on category for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tag_owner on tag for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy prompt_owner on prompt for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy prompt_tag_owner on prompt_tag for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy prompt_version_owner on prompt_version for all
  using (exists (select 1 from prompt p where p.id = prompt_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from prompt p where p.id = prompt_id and p.user_id = (select auth.uid())));
