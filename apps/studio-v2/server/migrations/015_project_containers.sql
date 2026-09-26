-- Projects (the four-notebook model): the project the creator sees is a
-- container for notebooks — its text, wireframe, presentation and video,
-- and whatever kinds come later — each a notebook of its own that names its
-- project in artifact->'container'. This table holds what belongs to the
-- whole project; which notebooks it holds is read off the notebooks.
create table if not exists studio_containers (
  id text primary key,
  title text not null,
  artifact jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_notebooks_container
  on studio_notebooks ((artifact->'container'->>'id'));
