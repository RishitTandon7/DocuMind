/**
 * Shared TypeScript types mirroring the backend's Pydantic response schemas.
 */

export type DocumentStatus =
  | "uploaded"
  | "processing_dip"
  | "processing_ocr"
  | "processing_understanding"
  | "processing_graph"
  | "processing_embeddings"
  | "completed"
  | "failed";

export interface UploadResponse {
  document_id: string;
  filename: string;
  status: DocumentStatus;
  upload_time: string;
  page_count: number;
}

export interface DocumentStatusResponse {
  document_id: string;
  filename: string;
  status: DocumentStatus;
  error_message: string | null;
  upload_time: string;
  completed_time: string | null;
}

export interface DIPOperation {
  id: string;
  operation_name: string;
  params: Record<string, unknown>;
  psnr_before: number;
  psnr_after: number;
  ssim_before: number;
  ssim_after: number;
  image_before_url: string;
  image_after_url: string;
  step_order: number;
  timestamp: string;
}

export type DetectionStatus = "success" | "fallback" | "";

export interface DIPOperationsResponse {
  document_id: string;
  original_image_url: string;
  original_width: number;
  original_height: number;
  detected_corners: number[][];
  detection_method: string;
  detection_status: DetectionStatus;
  page_number: number;
  page_count: number;
  color_image_url: string;
  grayscale_image_url: string;
  bw_image_url: string;
  operations: DIPOperation[];
}

export type ScanMode = "color" | "grayscale" | "bw";

export interface DocumentSummary {
  document_id: string;
  filename: string;
  status: DocumentStatus;
  upload_time: string;
  thumbnail_url: string | null;
}

export interface DocumentListResponse {
  documents: DocumentSummary[];
}

export interface DocumentLibraryItem {
  document_id: string;
  filename: string;
  status: DocumentStatus;
  upload_time: string;
  completed_time: string | null;
  thumbnail_url: string | null;
  word_count: number | null;
  error_message: string | null;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

export interface DocumentLibraryResponse {
  documents: DocumentLibraryItem[];
  pagination: PaginationMeta;
}

export interface OCRResponse {
  document_id: string;
  raw_text: string;
  confidence: number;
  word_count: number;
  timestamp: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  properties?: Record<string, unknown>;
}

export interface GraphResponse {
  document_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AgentLogEntry {
  id: string;
  agent_name: string;
  action: string;
  decision: string | null;
  reasoning: string | null;
  timestamp: string;
}

export interface AgentLogResponse {
  document_id: string;
  logs: AgentLogEntry[];
}

export interface QuerySource {
  content: string;
  score: number;
  source_type: string;
  metadata: Record<string, unknown>;
}

export interface QueryResponse {
  question: string;
  answer: string;
  sources: QuerySource[];
  retrieval_strategy: string;
  confidence: number;
  timestamp: string;
}

export interface AgentStreamEvent {
  type: "agent_event" | "heartbeat";
  document_id?: string;
  agent_name?: string;
  action?: string;
  decision?: string | null;
  reasoning?: string | null;
  timestamp?: string;
}

export interface PageInfo {
  page_number: number;
  original_url: string;
  color_url: string;
  grayscale_url: string;
  bw_url: string;
  detection_status: DetectionStatus;
}

export interface PagesResponse {
  document_id: string;
  filename: string;
  pages: PageInfo[];
}

export interface DetectCornersResponse {
  found: boolean;
  method: string;
  corners: number[][];
  width: number;
  height: number;
}
