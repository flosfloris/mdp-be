-- FestaDeiPiccoli Database Schema
-- PostgreSQL with UUID support and proper indexing

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Regioni (20 Italian regions)
CREATE TABLE regioni (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE
);

-- Categorie Animazione
CREATE TABLE categorie_animazione (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  icona VARCHAR(100)
);

-- Categorie Location
CREATE TABLE categorie_location (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  icona VARCHAR(100)
);

-- Users (Providers and potentially visitors who register)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  nome VARCHAR(100),
  cognome VARCHAR(100),
  telefono VARCHAR(20),
  avatar_url TEXT,
  tipo_provider VARCHAR(50),
  nome_attivita VARCHAR(200),
  descrizione_attivita TEXT,
  citta VARCHAR(100),
  regione VARCHAR(100),
  indirizzo VARCHAR(255),
  sito_web VARCHAR(255),
  instagram VARCHAR(100),
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_citta ON users(citta);
CREATE INDEX idx_users_regione ON users(regione);
CREATE INDEX idx_users_tipo_provider ON users(tipo_provider);
CREATE INDEX idx_users_attivo ON users(attivo);

-- Servizi (Services offered by providers)
CREATE TABLE servizi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  titolo VARCHAR(200) NOT NULL,
  descrizione TEXT,
  prezzo_indicativo DECIMAL(10, 2),
  prezzo_max DECIMAL(10, 2),
  durata_minuti INTEGER,
  capienza_max INTEGER,
  eta_minima INTEGER,
  eta_massima INTEGER,
  indoor_outdoor VARCHAR(50),
  citta VARCHAR(100),
  indirizzo VARCHAR(255),
  tags TEXT[],
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_servizi_updated_at BEFORE UPDATE ON servizi
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_servizi_provider_id ON servizi(provider_id);
CREATE INDEX idx_servizi_tipo ON servizi(tipo);
CREATE INDEX idx_servizi_citta ON servizi(citta);
CREATE INDEX idx_servizi_attivo ON servizi(attivo);
CREATE INDEX idx_servizi_eta_minima ON servizi(eta_minima);
CREATE INDEX idx_servizi_eta_massima ON servizi(eta_massima);

-- Junction table: Servizi <-> Categorie
CREATE TABLE servizi_categorie (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  servizio_id UUID NOT NULL REFERENCES servizi(id) ON DELETE CASCADE,
  categoria_animazione_id INTEGER REFERENCES categorie_animazione(id) ON DELETE SET NULL,
  categoria_location_id INTEGER REFERENCES categorie_location(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_servizi_categorie_servizio_id ON servizi_categorie(servizio_id);
CREATE INDEX idx_servizi_categorie_animazione ON servizi_categorie(categoria_animazione_id);
CREATE INDEX idx_servizi_categorie_location ON servizi_categorie(categoria_location_id);

-- Foto Servizi (Photos/images for services)
CREATE TABLE foto_servizi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  servizio_id UUID NOT NULL REFERENCES servizi(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  posizione INTEGER,
  alt_text VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_foto_servizi_servizio_id ON foto_servizi(servizio_id);
CREATE INDEX idx_foto_servizi_posizione ON foto_servizi(servizio_id, posizione);

-- Messaggi (Internal messaging between visitors and providers)
CREATE TABLE messaggi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  servizio_id UUID REFERENCES servizi(id) ON DELETE SET NULL,
  mittente_nome VARCHAR(200) NOT NULL,
  mittente_email VARCHAR(255) NOT NULL,
  mittente_telefono VARCHAR(20),
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  oggetto VARCHAR(255) NOT NULL,
  messaggio TEXT NOT NULL,
  letto BOOLEAN DEFAULT false,
  risposta TEXT,
  risposto_il TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messaggi_provider_id ON messaggi(provider_id);
CREATE INDEX idx_messaggi_servizio_id ON messaggi(servizio_id);
CREATE INDEX idx_messaggi_letto ON messaggi(letto);
CREATE INDEX idx_messaggi_created_at ON messaggi(created_at);

-- Seed data for Regioni (20 Italian regions)
INSERT INTO regioni (nome, slug) VALUES
('Abruzzo', 'abruzzo'),
('Basilicata', 'basilicata'),
('Calabria', 'calabria'),
('Campania', 'campania'),
('Emilia-Romagna', 'emilia-romagna'),
('Friuli-Venezia Giulia', 'friuli-venezia-giulia'),
('Lazio', 'lazio'),
('Liguria', 'liguria'),
('Lombardia', 'lombardia'),
('Marche', 'marche'),
('Molise', 'molise'),
('Piemonte', 'piemonte'),
('Puglia', 'puglia'),
('Sardegna', 'sardegna'),
('Sicilia', 'sicilia'),
('Toscana', 'toscana'),
('Trentino-Alto Adige', 'trentino-alto-adige'),
('Umbria', 'umbria'),
('Valle d''Aosta', 'valle-d-aosta'),
('Veneto', 'veneto')
ON CONFLICT (slug) DO NOTHING;

-- Seed data for Categorie Animazione
INSERT INTO categorie_animazione (nome, slug, icona) VALUES
('Mago', 'mago', 'wand'),
('Clown', 'clown', 'laugh'),
('Giochi', 'giochi', 'gamepad2'),
('Truccabimbi', 'truccabimbi', 'palette'),
('Spettacoli', 'spettacoli', 'star'),
('Bolle di Sapone', 'bolle-di-sapone', 'cloud'),
('Balloon Art', 'balloon-art', 'balloon'),
('Mascotte', 'mascotte', 'smile'),
('DJ per Bambini', 'dj-bambini', 'music'),
('Laboratori', 'laboratori', 'hammer')
ON CONFLICT (slug) DO NOTHING;

-- Seed data for Categorie Location
INSERT INTO categorie_location (nome, slug, icona) VALUES
('Sala Feste', 'sala-feste', 'home'),
('Agriturismo', 'agriturismo', 'tree'),
('Parco', 'parco', 'leaf'),
('Ludoteca', 'ludoteca', 'puzzle'),
('Ristorante con Area Bimbi', 'ristorante-area-bimbi', 'utensils'),
('Spazio all''Aperto', 'spazio-aperto', 'sun'),
('Villa', 'villa', 'building'),
('Piscina', 'piscina', 'wave')
ON CONFLICT (slug) DO NOTHING;
