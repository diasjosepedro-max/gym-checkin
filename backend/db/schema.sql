
-- Utilizadores (admins)
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(150) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  name       VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()




-- Membros
CREATE TABLE IF NOT EXISTS members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Professores
CREATE TABLE IF NOT EXISTS teachers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Aulas
CREATE TABLE IF NOT EXISTS classes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  day             INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
  time            VARCHAR(5) NOT NULL,
  duration        INTEGER NOT NULL DEFAULT 60,
  teacher_id      UUID REFERENCES teachers(id) ON DELETE SET NULL,
  color           VARCHAR(20) DEFAULT '#85a800',
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Membros permitidos por aula
CREATE TABLE IF NOT EXISTS class_members (
  class_id  UUID REFERENCES classes(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, member_id)
);

-- Check-ins
CREATE TABLE IF NOT EXISTS checkins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID REFERENCES classes(id) ON DELETE CASCADE,
  member_id  UUID REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (class_id, member_id, date)
);

-- Pagamentos mensais
CREATE TABLE IF NOT EXISTS payments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  UUID REFERENCES members(id) ON DELETE CASCADE,
  month      VARCHAR(7) NOT NULL,
  paid       BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (member_id, month)
);