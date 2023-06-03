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
    /* Default 1, because a row in vid_meta will only be created once the client
     has sent a piece of data, and the client sends data as second long blobs*/
    seconds INT NOT NULL DEFAULT 1,
    active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vid_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vid_id UUID REFERENCES vid_meta(id) ON DELETE CASCADE,
    index INT NOT NULL DEFAULT 0,
    bytes BYTEA NOT NULL
);