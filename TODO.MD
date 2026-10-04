Here's the updated prompt:

---

> You are a senior software engineer and AI architect at a well-funded AI startup. We are building **DocuMind** — a startup-grade Agentic Multimodal Document Intelligence System. This is not a college project. This is a production-level product.
>
> ---
>
> ## Product Vision
>
> DocuMind accepts messy, scanned, low-quality documents and autonomously:
> - Analyzes and fixes image quality using adaptive Digital Image Processing
> - Extracts text via OCR
> - Understands document content using multimodal LLM
> - Builds a Knowledge Graph of entities and relationships
> - Answers user questions using Hybrid Graph + Vector RAG
> - Shows every agent decision in real time
>
> ---
>
> ## Tech Stack
>
> | Layer | Technology |
> |---|---|
> | Backend | Python 3.11 + FastAPI |
> | DIP | OpenCV, NumPy, scikit-image |
> | Agents | LangGraph |
> | LLM/VLM | Gemini 1.5 Flash |
> | OCR | PaddleOCR |
> | Vector DB | ChromaDB |
> | Graph DB | Neo4j |
> | Embeddings | BAAI/bge-small-en-v1.5 |
> | Reranker | cross-encoder/ms-marco-MiniLM-L-6-v2 |
> | PDF Parsing | PyMuPDF |
> | Frontend | Next.js 14 + Tailwind CSS + shadcn/ui |
> | Metadata DB | PostgreSQL |
> | Deployment | Docker Compose |
> | Realtime | WebSockets |
>
> ---
>
> ## Folder Structure
>
> ```
> documind/
> ├── backend/
> │   ├── main.py                        # FastAPI entry point
> │   ├── config.py                      # All env vars, settings
> │   ├── agents/
> │   │   ├── __init__.py
> │   │   ├── supervisor.py
> │   │   ├── image_analysis.py
> │   │   ├── dip_agent.py
> │   │   ├── ocr_agent.py
> │   │   ├── doc_understanding.py
> │   │   ├── kg_agent.py
> │   │   ├── rag_agent.py
> │   │   ├── hybrid_retrieval.py
> │   │   └── verification.py
> │   ├── dip/
> │   │   ├── __init__.py
> │   │   ├── filters.py                 # Gaussian, median, bilateral
> │   │   ├── enhancement.py             # CLAHE, histogram eq
> │   │   ├── geometry.py                # Deskew, perspective correction
> │   │   ├── morphology.py              # Erosion, dilation, opening, closing
> │   │   ├── edge_detection.py          # Canny, Sobel
> │   │   ├── frequency.py               # DFT, DCT
> │   │   └── quality_metrics.py         # PSNR, SSIM, blur score, noise score
> │   ├── ocr/
> │   │   ├── __init__.py
> │   │   └── paddle_ocr.py
> │   ├── graph/
> │   │   ├── __init__.py
> │   │   ├── neo4j_client.py
> │   │   └── entity_extractor.py
> │   ├── rag/
> │   │   ├── __init__.py
> │   │   ├── chunker.py
> │   │   ├── embedder.py
> │   │   ├── chroma_client.py
> │   │   └── reranker.py
> │   ├── api/
> │   │   ├── __init__.py
> │   │   ├── routes/
> │   │   │   ├── documents.py
> │   │   │   ├── query.py
> │   │   │   └── websocket.py
> │   │   └── middleware/
> │   │       ├── cors.py
> │   │       └── error_handler.py
> │   ├── models/
> │   │   ├── __init__.py
> │   │   └── schemas.py
> │   ├── db/
> │   │   ├── __init__.py
> │   │   ├── postgres.py
> │   │   └── migrations/
> │   │       └── init.sql
> │   └── utils/
> │       ├── __init__.py
> │       ├── image_utils.py
> │       ├── file_utils.py
> │       └── logger.py
> ├── frontend/
> │   ├── app/
> │   │   ├── page.tsx                   # Landing / upload page
> │   │   ├── layout.tsx
> │   │   ├── document/
> │   │   │   └── [id]/
> │   │   │       └── page.tsx           # Document processing dashboard
> │   │   └── query/
> │   │       └── [id]/
> │   │           └── page.tsx           # Q&A interface
> │   ├── components/
> │   │   ├── ui/                        # shadcn components
> │   │   ├── ImageComparison.tsx        # Before/after DIP viewer
> │   │   ├── AgentTimeline.tsx          # Live agent log
> │   │   ├── KnowledgeGraphViewer.tsx   # Interactive graph (react-force-graph)
> │   │   ├── ChunkViewer.tsx            # RAG chunks + scores
> │   │   ├── AnswerCard.tsx             # Answer + sources + confidence
> │   │   ├── DIPOperationCard.tsx       # Each DIP step + metrics
> │   │   ├── FileUpload.tsx             # Drag and drop uploader
> │   │   └── StatusBadge.tsx
> │   ├── lib/
> │   │   ├── api.ts                     # API client
> │   │   └── websocket.ts               # WebSocket client
> │   ├── hooks/
> │   │   ├── useDocument.ts
> │   │   └── useAgentStream.ts
> │   └── types/
> │       └── index.ts
> ├── docker-compose.yml
> ├── .env.example
> ├── requirements.txt
> └── README.md
> ```
>
> ---
>
> ## Design Standards
>
> **Backend:**
> - Clean architecture — routes → services → db, never mix concerns
> - Pydantic v2 for all schemas
> - Structured logging with `loguru`
> - All config via `.env` and `pydantic-settings`
> - Proper HTTP status codes and error responses
> - Async FastAPI endpoints throughout
> - Each DIP function returns `{ processed_image, operation_name, params_used, psnr_before, psnr_after, ssim_before, ssim_after }` — never just the image
>
> **Frontend:**
> - Dark mode first, professional dark UI like Linear or Vercel
> - Smooth animations with Framer Motion
> - Real-time agent log streamed via WebSocket — displayed as a timeline
> - Before/after image slider for DIP comparison
> - Interactive Knowledge Graph with zoom/pan using react-force-graph
> - Mobile responsive
> - Loading skeletons, not spinners
> - No placeholder UI — every component should look shippable
>
> ---
>
> ## API Routes
>
> ```
> POST   /api/v1/documents/upload          → upload + start pipeline
> GET    /api/v1/documents/{id}/status     → processing status
> GET    /api/v1/documents/{id}/dip        → DIP operations + images + metrics
> GET    /api/v1/documents/{id}/ocr        → extracted text + confidence
> GET    /api/v1/documents/{id}/graph      → KG nodes + edges
> GET    /api/v1/documents/{id}/agents-log → full agent decision log
> POST   /api/v1/query                     → question → answer + sources
> WS     /ws/{document_id}                 → real-time agent stream
> ```
>
> ---
>
> ## PostgreSQL Schema
>
> ```sql
> documents (id, filename, file_path, status, upload_time, completed_time)
> dip_operations (id, doc_id, operation_name, params, psnr_before, psnr_after, ssim_before, ssim_after, image_before_path, image_after_path, timestamp)
> ocr_results (id, doc_id, raw_text, confidence, word_count, timestamp)
> agent_logs (id, doc_id, agent_name, action, decision, reasoning, timestamp)
> query_history (id, doc_id, question, answer, sources, retrieval_strategy, confidence, timestamp)
> ```
>
> ---
>
> ## Phase 1 — What to Build Now
>
> **Do NOT build everything at once. Phase 1 only.**
>
> Phase 1 goals:
>
> 1. **Scaffold** — create the complete folder structure with all `__init__.py` files and placeholder modules
> 2. **Config** — `config.py` with pydantic-settings, `.env.example` with all required variables
> 3. **DIP Module** — implement fully in `dip/`:
>    - `filters.py` — Gaussian, median, bilateral filter
>    - `enhancement.py` — CLAHE, histogram equalization
>    - `geometry.py` — deskew using Hough transform, adaptive thresholding
>    - `morphology.py` — erosion, dilation, opening, closing
>    - `edge_detection.py` — Canny, Sobel
>    - `quality_metrics.py` — PSNR, SSIM, blur score (Laplacian variance), noise estimate
>    - Every function must be commented explaining the DIP concept behind it
>    - Every function returns a typed `DIPResult` dataclass with image + metrics
> 4. **Fixed pipeline** — `dip_pipeline.py` runs: grayscale → denoise → enhance → deskew → threshold → return all step results
> 5. **OCR** — PaddleOCR integration in `ocr/paddle_ocr.py`, returns text + per-word confidence
> 6. **FastAPI** — `/upload` and `/document/{id}/status` routes working end to end
> 7. **PostgreSQL** — migrations in `db/migrations/init.sql`, async connection with `asyncpg`
> 8. **Docker Compose** — FastAPI + PostgreSQL + Neo4j + ChromaDB all running with one `docker-compose up`
> 9. **Frontend** — Next.js app with:
>    - Beautiful dark landing page with drag-and-drop file upload
>    - Document page showing original image + each DIP step with before/after + metrics
>    - OCR extracted text panel
>    - All using real data from the API, no mocks
>
> ---
>
> ## Rules
>
> - Every file must have a module-level docstring explaining what it does
> - No `TODO` comments — either implement it or don't include it
> - No hardcoded values anywhere — everything through config
> - No mock data on the frontend — connect to real API from day one
> - Logging on every significant operation using `loguru`
> - Type hints on every function, every parameter, every return value
> - Error handling on every external call (OCR, DB, file ops)
> - The frontend must look like a real product, not a student project
>
> ---
>
> Build Phase 1 completely. Do not stop halfway. Start with folder structure, then config, then DIP module, then API, then frontend.

Do not stop. Do not summarize. Do not say "here's what I would do next."

Write every single file. Completely. No placeholders. No # TODO. No pass statements. No truncation.

Every file listed in the folder structure must exist with full working code by the time you are done.

Specifically:

Every DIP function — fully implemented with OpenCV/NumPy, not stubs
Every API route — fully implemented, connected to real DB, not mocked
Every frontend component — fully implemented with real API calls, not dummy data
Docker Compose — fully working, all services configured with health checks
PostgreSQL migrations — complete schema, runs on first boot
requirements.txt — every dependency pinned
.env.example — every variable documented

If you are running low on context, prioritize in this order:

DIP module (all files, fully complete)
FastAPI backend (all routes, fully complete)
PostgreSQL schema
Docker Compose
Frontend (all components, fully complete)

Do not ask me questions. Do not wait for confirmation. Do not break it into parts and ask which to do first.

Start immediately. Write everything. Finish completely.