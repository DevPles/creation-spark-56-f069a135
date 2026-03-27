
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Facility units enum
CREATE TYPE public.facility_unit AS ENUM ('Hospital Geral', 'UPA Norte', 'UBS Centro');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cargo TEXT,
  facility_unit facility_unit NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, facility_unit)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'facility_unit')::facility_unit, 'Hospital Geral')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Goals table (admin creates goals per unit)
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT '%',
  type TEXT NOT NULL DEFAULT 'QNT',
  weight NUMERIC NOT NULL DEFAULT 0.1,
  risk NUMERIC NOT NULL DEFAULT 0,
  facility_unit facility_unit NOT NULL,
  scoring JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view goals" ON public.goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert goals" ON public.goals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update goals" ON public.goals FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Goal entries (employees submit realized values)
CREATE TABLE public.goal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  period TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entries for their unit goals" ON public.goal_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own entries" ON public.goal_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own entries" ON public.goal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_goal_entries_goal_id ON public.goal_entries(goal_id);
CREATE INDEX idx_goal_entries_user_id ON public.goal_entries(user_id);
