-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.contributions (
  id bigint NOT NULL DEFAULT nextval('contributions_id_seq'::regclass),
  member_id uuid NOT NULL,
  type USER-DEFINED NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  contribution_date date NOT NULL DEFAULT CURRENT_DATE,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contributions_pkey PRIMARY KEY (id),
  CONSTRAINT contributions_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id)
);
CREATE TABLE public.loan_payments (
  id bigint NOT NULL DEFAULT nextval('loan_payments_id_seq'::regclass),
  loan_id bigint NOT NULL DEFAULT nextval('loan_payments_loan_id_seq'::regclass),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_type USER-DEFINED,
  CONSTRAINT loan_payments_pkey PRIMARY KEY (id),
  CONSTRAINT loan_payments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id)
);
CREATE TABLE public.loans (
  id bigint NOT NULL DEFAULT nextval('loans_id_seq'::regclass),
  borrower_id uuid NOT NULL,
  principal_amount numeric NOT NULL CHECK (principal_amount >= 0::numeric),
  term_months integer CHECK (term_months > 0),
  service_charge_rate numeric NOT NULL DEFAULT 0.02,
  service_charge_amount numeric DEFAULT round((principal_amount * service_charge_rate), 2),
  status USER-DEFINED NOT NULL DEFAULT 'APPROVED'::loan_status,
  approved_at timestamp with time zone NOT NULL DEFAULT now(),
  released_at timestamp with time zone,
  completed_at timestamp with time zone,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT loans_pkey PRIMARY KEY (id),
  CONSTRAINT loans_borrower_id_fkey FOREIGN KEY (borrower_id) REFERENCES public.members(id)
);
CREATE TABLE public.members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  contact_info text,
  join_date date NOT NULL DEFAULT CURRENT_DATE,
  total_shares numeric NOT NULL DEFAULT 0,
  total_social_fund_contributions numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  total_penalties integer,
  record_id smallint,
  CONSTRAINT members_pkey PRIMARY KEY (id)
);