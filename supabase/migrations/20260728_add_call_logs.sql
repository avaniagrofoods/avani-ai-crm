-- Supabase migration: create tables for call logs, lead responses, and WhatsApp status
-- Table: call_logs
CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id text NOT NULL,               -- VAPI or Bland AI call identifier
  phone_number text NOT NULL,          -- E.164 format
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  transcript jsonb,                    -- Full transcript if available
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table: lead_responses
CREATE TABLE IF NOT EXISTS public.lead_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  loan_type text,                       -- e.g., personal, business, doctor, …
  full_name text,
  city text,
  email text,
  employment_type text,                -- salaried, self‑employed, professional, etc.
  monthly_income numeric,
  loan_amount numeric,
  additional_data jsonb,               -- catch‑all for extra fields per loan type
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table: whatsapp_status
CREATE TABLE IF NOT EXISTS public.whatsapp_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  message_id text,                      -- Meta message id
  status text NOT NULL,                 -- sent, delivered, failed, seen
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_call_logs_phone ON public.call_logs (phone_number);
CREATE INDEX IF NOT EXISTS idx_lead_responses_phone ON public.lead_responses (phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_status_phone ON public.whatsapp_status (phone_number);
