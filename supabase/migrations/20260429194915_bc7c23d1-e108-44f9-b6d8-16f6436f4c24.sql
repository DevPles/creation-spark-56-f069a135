CREATE TABLE IF NOT EXISTS public.opme_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.opme_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to opme_materials" 
ON public.opme_materials FOR SELECT USING (true);

-- Inserindo alguns materiais comuns de OPME
INSERT INTO public.opme_materials (code, name, description) VALUES 
('0702030060', 'STENT CORONARIO RECOBERTO COM DROGA', 'OPME para cardiologia'),
('0702050010', 'PROTESE VALVULAR BIOLOGICA', 'OPME para cardiologia'),
('0702030010', 'MARCAPASSO CARDIACO MULTIPROGRAMAVEL BICAMERAL', 'OPME para cardiologia'),
('0702050363', 'PLACA PARA OSTEOSSINTESE EM MINI-FRAGMENTOS', 'OPME para ortopedia'),
('0702050371', 'PARAFUSO PARA OSTEOSSINTESE EM MINI-FRAGMENTOS', 'OPME para ortopedia'),
('0702050517', 'HASTE INTRAMEDULAR BLOQUEADA DE TIBIA', 'OPME para ortopedia'),
('0702050029', 'PROTESE TOTAL DE QUADRIL CIMENTADA', 'OPME para ortopedia'),
('0702050037', 'PROTESE TOTAL DE QUADRIL NAO CIMENTADA', 'OPME para ortopedia'),
('0702050185', 'PROTESE TOTAL DE JOELHO', 'OPME para ortopedia'),
('0702050193', 'PROTESE PARCIAL DE JOELHO', 'OPME para ortopedia')
ON CONFLICT (code) DO NOTHING;
