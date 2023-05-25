DROP SCHEMA public CASCADE;

CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE streamers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(24) NOT NULL
);

CREATE TABLE vid_meta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    size INT NOT NULL DEFAULT 0,
    name VARCHAR(24) NOT NULL,
    streamer UUID REFERENCES streamers(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT FALSE
);

CREATE TABLE vid_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vid_id UUID REFERENCES vid_meta(id) ON DELETE CASCADE,
    index INT NOT NULL DEFAULT 0,
    bytes BYTEA NOT NULL
);