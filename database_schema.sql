-- SHL Simulator Database Schema
-- Databas: shl_simulator
-- Version: 2.0
-- Datum: 2025-10-28

-- Skapa databas
CREATE DATABASE IF NOT EXISTS shl_simulator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shl_simulator;

-- 1. Lag-tabell
CREATE TABLE teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT 'Lagnamn (t.ex. Frölunda HC)',
    short_name VARCHAR(10) NOT NULL COMMENT 'Förkortning (t.ex. FHC)',
    city VARCHAR(50) COMMENT 'Stad',
    logo_url VARCHAR(255) COMMENT 'URL till laglogga',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_short_name (short_name)
) ENGINE=InnoDB COMMENT='SHL-lag';

-- 2. Säsongstatistik
CREATE TABLE team_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    season VARCHAR(10) NOT NULL DEFAULT '2024-25' COMMENT 'Säsong (t.ex. 2024-25)',
    games_played INT DEFAULT 0 COMMENT 'Spelade matcher',
    wins INT DEFAULT 0 COMMENT 'Vinster ordinarie tid',
    overtime_wins INT DEFAULT 0 COMMENT 'Vinster förlängning/straffar',
    losses INT DEFAULT 0 COMMENT 'Förluster ordinarie tid', 
    overtime_losses INT DEFAULT 0 COMMENT 'Förluster förlängning/straffar',
    goals_for INT DEFAULT 0 COMMENT 'Gjorda mål',
    goals_against INT DEFAULT 0 COMMENT 'Insläppta mål',
    points INT GENERATED ALWAYS AS (
        (wins * 3) + (overtime_wins * 2) + (overtime_losses * 1)
    ) STORED COMMENT 'Poäng (automatiskt beräknat)',
    goal_difference INT GENERATED ALWAYS AS (
        goals_for - goals_against  
    ) STORED COMMENT 'Målskillnad (automatiskt beräknat)',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_team_season (team_id, season),
    INDEX idx_season (season),
    INDEX idx_points (points DESC),
    INDEX idx_goal_diff (goal_difference DESC)
) ENGINE=InnoDB COMMENT='Lagstatistik per säsong';

-- 3. Matcher
CREATE TABLE matches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    home_team_id INT NOT NULL,
    away_team_id INT NOT NULL,
    match_date DATE NOT NULL COMMENT 'Matchdatum',
    match_time TIME DEFAULT '19:00' COMMENT 'Matchtid',
    home_goals INT NULL COMMENT 'Mål hemmalag (NULL = ej spelad)',
    away_goals INT NULL COMMENT 'Mål bortalag (NULL = ej spelad)',
    match_type ENUM('regular', 'overtime', 'shootout') NULL COMMENT 'Hur matchen avgjordes',
    finished BOOLEAN DEFAULT FALSE COMMENT 'Match spelad och klar',
    season VARCHAR(10) DEFAULT '2024-25',
    arena VARCHAR(100) COMMENT 'Arena',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (home_team_id) REFERENCES teams(id),
    FOREIGN KEY (away_team_id) REFERENCES teams(id),
    INDEX idx_match_date (match_date),
    INDEX idx_finished (finished),
    INDEX idx_season (season),
    CHECK (home_team_id != away_team_id),
    CHECK (home_goals >= 0 OR home_goals IS NULL),
    CHECK (away_goals >= 0 OR away_goals IS NULL)
) ENGINE=InnoDB COMMENT='SHL-matcher';

-- 4. Admin-användare (för Google OAuth)
CREATE TABLE admin_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100),
    google_id VARCHAR(100) UNIQUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE,
    INDEX idx_email (email),
    INDEX idx_google_id (google_id)
) ENGINE=InnoDB COMMENT='Auktoriserade admin-användare';

-- Lägg till grunddata - alla 14 SHL-lag
INSERT INTO teams (name, short_name, city) VALUES
('Brynäs IF', 'BIF', 'Gävle'),
('Djurgården IF', 'DIF', 'Stockholm'), 
('Färjestad BK', 'FBK', 'Karlstad'),
('Frölunda HC', 'FHC', 'Göteborg'),
('HV71', 'HV71', 'Jönköping'),
('Leksands IF', 'LIF', 'Leksand'),
('Linköping HC', 'LHC', 'Linköping'),
('Luleå HF', 'LHF', 'Luleå'),
('Malmö Redhawks', 'MIF', 'Malmö'),
('Rögle BK', 'RBK', 'Ängelholm'),
('Skellefteå AIK', 'SAIK', 'Skellefteå'),
('Timrå IK', 'TIK', 'Timrå'),
('Växjö Lakers', 'VLH', 'Växjö'),
('Örebro HK', 'ÖHK', 'Örebro');

-- Skapa grundstatistik för alla lag (tom säsong)
INSERT INTO team_stats (team_id, season, games_played, wins, overtime_wins, losses, overtime_losses, goals_for, goals_against)
SELECT id, '2024-25', 0, 0, 0, 0, 0, 0, 0 FROM teams;

-- Skapa en admin-användare (byt ut email)
INSERT INTO admin_users (email, name) VALUES 
('admin@example.com', 'Admin Användare');

-- Visa tabellen sorterad (för test)
CREATE VIEW current_standings AS
SELECT 
    t.name AS lag,
    t.short_name AS kort,
    ts.games_played AS m,
    ts.wins AS v,
    ts.overtime_wins AS vö,
    ts.losses AS f, 
    ts.overtime_losses AS fö,
    ts.goals_for AS gm,
    ts.goals_against AS im,
    ts.goal_difference AS ms,
    ts.points AS p
FROM team_stats ts
JOIN teams t ON ts.team_id = t.id  
WHERE ts.season = '2024-25'
ORDER BY ts.points DESC, ts.goal_difference DESC, ts.goals_for DESC;