-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.graph_edges (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  project_id uuid NOT NULL,
  source_unit_name text NOT NULL,
  target_unit_name text NOT NULL,
  edge_type text NOT NULL DEFAULT 'calls'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT graph_edges_pkey PRIMARY KEY (id)
);
CREATE TABLE public.jira_tokens (
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at double precision NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT jira_tokens_pkey PRIMARY KEY (user_id),
  CONSTRAINT jira_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.memory_units (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  project_id uuid NOT NULL,
  unit_name text NOT NULL,
  unit_type text NOT NULL,
  file_path text NOT NULL,
  content text,
  code_footprint text,
  author_email text,
  last_modified_at timestamp with time zone,
  embedding USER-DEFINED,
  created_at timestamp with time zone DEFAULT now(),
  risk_score double precision,
  fts tsvector DEFAULT to_tsvector('english'::regconfig, ((unit_name || ' '::text) || content)),
  search_vector tsvector DEFAULT to_tsvector('english'::regconfig, ((COALESCE(unit_name, ''::text) || ' '::text) || COALESCE(content, ''::text))),
  CONSTRAINT memory_units_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notion_tokens (
  user_id text NOT NULL,
  access_token text NOT NULL,
  workspace_id text,
  bot_id text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT notion_tokens_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.project_risks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  project_id uuid,
  risk_type text,
  severity text,
  description text,
  affected_units ARRAY,
  CONSTRAINT project_risks_pkey PRIMARY KEY (id),
  CONSTRAINT project_risks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  user_id text NOT NULL,
  repo_url text NOT NULL,
  last_commit text,
  sync_state jsonb DEFAULT '{"logs": [], "step": "Ready", "status": "idle"}'::jsonb,
  jira_project_id text,
  notion_project_id text,
  CONSTRAINT projects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_settings (
  user_id uuid NOT NULL,
  user_config jsonb DEFAULT '{"use_default": true}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_settings_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);