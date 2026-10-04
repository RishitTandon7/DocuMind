-- DocuMind PostgreSQL schema.
-- Applied automatically on first container boot via docker-entrypoint-initdb.d.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE document_status AS ENUM (
    'uploaded',
    'processing_dip',
    'processing_ocr',
    'processing_understanding',
    'processing_graph',
    'processing_embeddings',
    'completed',
    'failed'
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status document_status NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    upload_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_time TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dip_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    operation_name TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    psnr_before DOUBLE PRECISION NOT NULL DEFAULT 0,
    psnr_after DOUBLE PRECISION NOT NULL DEFAULT 0,
    ssim_before DOUBLE PRECISION NOT NULL DEFAULT 0,
    ssim_after DOUBLE PRECISION NOT NULL DEFAULT 0,
    image_before_path TEXT,
    image_after_path TEXT,
    step_order INTEGER NOT NULL DEFAULT 0,
    page_number INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    UNIQUE (doc_id, page_number)
);

CREATE TABLE IF NOT EXISTS ocr_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL DEFAULT '',
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    word_count INTEGER NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    action TEXT NOT NULL,
    decision TEXT,
    reasoning TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id UUID REFERENCES documents (id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    retrieval_strategy TEXT NOT NULL DEFAULT 'hybrid',
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dip_operations_doc_id ON dip_operations (doc_id);
CREATE INDEX IF NOT EXISTS idx_ocr_results_doc_id ON ocr_results (doc_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_doc_id ON agent_logs (doc_id);
CREATE INDEX IF NOT EXISTS idx_query_history_doc_id ON query_history (doc_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (status);
CREATE INDEX IF NOT EXISTS idx_document_pages_doc_id ON document_pages (doc_id);
CREATE INDEX IF NOT EXISTS idx_dip_operations_page ON dip_operations (doc_id, page_number);
