"""
Application configuration.

Centralizes all environment-driven settings for the DocuMind backend using
pydantic-settings. Every configurable value used anywhere in the backend
must be declared here and sourced from the environment (.env) — no
hardcoded values are permitted elsewhere in the codebase.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly typed application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- General ---
    app_name: str = Field(default="DocuMind", description="Application name")
    app_env: str = Field(default="development", description="Deployment environment")
    debug: bool = Field(default=True, description="Enable debug mode")
    api_v1_prefix: str = Field(default="/api/v1", description="API v1 route prefix")
    log_level: str = Field(default="INFO", description="Loguru log level")

    # --- CORS ---
    cors_allowed_origins: str = Field(
        default="http://localhost:3000",
        description="Comma-separated list of allowed CORS origins",
    )

    # --- PostgreSQL ---
    postgres_host: str = Field(default="localhost", description="PostgreSQL host")
    postgres_port: int = Field(default=5432, description="PostgreSQL port")
    postgres_user: str = Field(default="documind", description="PostgreSQL user")
    postgres_password: str = Field(default="documind", description="PostgreSQL password")
    postgres_db: str = Field(default="documind", description="PostgreSQL database name")

    # --- Neo4j ---
    neo4j_uri: str = Field(default="bolt://localhost:7687", description="Neo4j bolt URI")
    neo4j_user: str = Field(default="neo4j", description="Neo4j username")
    neo4j_password: str = Field(default="documind_neo4j", description="Neo4j password")

    # --- ChromaDB ---
    chroma_host: str = Field(default="localhost", description="ChromaDB host")
    chroma_port: int = Field(default=8001, description="ChromaDB port")
    chroma_collection_name: str = Field(
        default="documind_chunks", description="Default ChromaDB collection name"
    )

    # --- LLM / VLM ---
    llm_provider: str = Field(
        default="gemini", description="LLM backend to use: 'gemini' or 'ollama'"
    )
    gemini_api_key: str = Field(default="", description="Google Gemini API key")
    gemini_model_name: str = Field(
        default="gemini-1.5-flash", description="Gemini model identifier"
    )
    ollama_base_url: str = Field(
        default="http://localhost:11434", description="Ollama server base URL"
    )
    ollama_text_model: str = Field(
        default="llama3.2", description="Ollama model for text-only generation"
    )
    ollama_vision_model: str = Field(
        default="qwen3-vl:4b", description="Ollama multimodal model for image+text generation"
    )

    # --- Embeddings / Reranker ---
    embedding_model_name: str = Field(
        default="BAAI/bge-small-en-v1.5", description="Sentence embedding model"
    )
    reranker_model_name: str = Field(
        default="cross-encoder/ms-marco-MiniLM-L-6-v2", description="Cross-encoder reranker model"
    )

    # --- OCR ---
    paddleocr_lang: str = Field(default="en", description="PaddleOCR language code")
    paddleocr_use_gpu: bool = Field(default=False, description="Whether PaddleOCR should use GPU")

    # --- Storage ---
    storage_root: str = Field(default="storage", description="Root directory for file storage")
    upload_dir: str = Field(default="storage/uploads", description="Directory for raw uploads")
    processed_dir: str = Field(
        default="storage/processed", description="Directory for processed images"
    )
    max_upload_size_mb: int = Field(default=25, description="Maximum upload size in megabytes")
    allowed_upload_extensions: str = Field(
        default=".pdf,.png,.jpg,.jpeg,.tiff,.bmp",
        description="Comma-separated list of allowed upload file extensions",
    )

    # --- RAG ---
    chunk_size: int = Field(default=512, description="Token chunk size for RAG chunking")
    chunk_overlap: int = Field(default=64, description="Token overlap between chunks")
    retrieval_top_k: int = Field(default=10, description="Number of candidates to retrieve")
    rerank_top_k: int = Field(default=5, description="Number of candidates to keep after rerank")

    # --- WebSocket ---
    ws_heartbeat_seconds: int = Field(
        default=30, description="Heartbeat interval for WebSocket connections"
    )

    @property
    def postgres_dsn(self) -> str:
        """Build an asyncpg-compatible PostgreSQL DSN from discrete settings."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        """Split the comma-separated CORS origins setting into a list."""
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def allowed_upload_extensions_list(self) -> list[str]:
        """Split the comma-separated allowed upload extensions setting into a list."""
        return [
            ext.strip().lower()
            for ext in self.allowed_upload_extensions.split(",")
            if ext.strip()
        ]

    def ensure_storage_dirs(self) -> None:
        """Create storage directories on disk if they do not already exist."""
        for directory in (self.storage_root, self.upload_dir, self.processed_dir):
            Path(directory).mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton instance of the application settings."""
    return Settings()
