"use client";

import { type ReactNode, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

import { CountUp } from "@/components/CountUp";
import { ImageCompareSlider } from "@/components/ImageCompareSlider";
import { StageFlipIcon } from "@/components/panel/StageFlipIcon";
import { resolveMediaUrl } from "@/lib/api";
import { formatPercent } from "@/lib/utils";
import type { DIPOperationsResponse, GraphResponse, OCRResponse } from "@/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const TYPE_COLORS: Record<string, string> = {
  PERSON: "#818cf8",
  ORGANIZATION: "#0ea5b5",
  DATE: "#22a35a",
  LOCATION: "#d97706",
  AMOUNT: "#e0537a",
  DOCUMENT: "#7c5cd6",
  OTHER: "#78716c",
};

interface PipelineTabProps {
  dip: DIPOperationsResponse | null;
  ocr: OCRResponse | null;
  graph: GraphResponse | null;
}

function StageSection({
  title,
  complete,
  isLast,
  children,
}: {
  title: string;
  complete: boolean;
  isLast?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative pl-9">
      {!isLast && (
        <div className="absolute left-3 top-7 h-[calc(100%+1.5rem)] w-px bg-black/10">
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: complete ? 1 : 0 }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: "top" }}
            className="h-full w-full bg-accent"
          />
        </div>
      )}
      <div className="absolute left-0 top-0">
        <StageFlipIcon complete={complete} />
      </div>
      <h3 className="mb-3 text-sm font-semibold tracking-tight text-ink">{title}</h3>
      <div className="mb-8">{children}</div>
    </div>
  );
}

export function PipelineTab({ dip, ocr, graph }: PipelineTabProps) {
  const hasDetection = !!dip && dip.original_image_url !== "";
  const hasEnhancement = !!dip && dip.operations.length > 0;
  const hasOcr = !!ocr;
  const hasGraph = !!graph;
  const fgRef = useRef<any>(null);

  const entitiesByType = useMemo(() => {
    if (!graph) return {};
    return graph.nodes.reduce<Record<string, typeof graph.nodes>>((acc, node) => {
      (acc[node.type] ??= []).push(node);
      return acc;
    }, {});
  }, [graph]);

  const graphData = useMemo(
    () => ({
      nodes: graph?.nodes.map((node) => ({ id: node.id, name: node.label, type: node.type })) ?? [],
      links:
        graph?.edges.map((edge) => ({ source: edge.source, target: edge.target, relation: edge.relation })) ?? [],
    }),
    [graph]
  );

  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;
    const fg = fgRef.current;
    fg.d3Force("charge")?.strength(-300);
    const timeout = setTimeout(() => fg.zoomToFit(400, 40), 300);
    return () => clearTimeout(timeout);
  }, [graphData]);

  const enhancementSteps = dip?.operations.filter(
    (op) => !["document_detection", "output_grayscale", "output_bw"].includes(op.operation_name)
  );
  const biggestStep = enhancementSteps?.[enhancementSteps.length - 1];
  const showLabels = graphData.nodes.length > 0 && graphData.nodes.length < 30;

  return (
    <div className="space-y-2">
      <StageSection title="Detect & Crop" complete={hasDetection}>
        {hasDetection ? (
          <div className="space-y-2">
            <div className="relative w-full overflow-hidden rounded-3xl border border-black/10 bg-black/5">
              <svg viewBox={`0 0 ${dip!.original_width} ${dip!.original_height}`} className="block h-auto w-full">
                <image href={resolveMediaUrl(dip!.original_image_url)} x="0" y="0" width={dip!.original_width} height={dip!.original_height} />
                {dip!.detection_status === "success" && dip!.detected_corners.length === 4 && (
                  <polygon
                    points={dip!.detected_corners.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="rgba(74, 222, 128, 0.12)"
                    stroke="#4ADE80"
                    strokeWidth={Math.max(dip!.original_width, dip!.original_height) * 0.004}
                  />
                )}
              </svg>
            </div>
            <p className="text-xs text-ink-soft">
              {dip!.detection_status === "success" ? (
                <>
                  Method: <span className="font-mono text-ink">{dip!.detection_method}</span>
                </>
              ) : (
                <span className="font-medium text-warning">Could not find document edges — used full image</span>
              )}
            </p>
          </div>
        ) : (
          <div className="skeleton-light aspect-video w-full rounded-3xl" />
        )}
      </StageSection>

      <StageSection title="Enhance" complete={hasEnhancement}>
        {hasEnhancement && biggestStep ? (
          <div className="space-y-4">
            <ImageCompareSlider
              beforeUrl={dip!.operations[0].image_after_url}
              afterUrl={biggestStep.image_after_url}
              beforeLabel="Original crop"
              afterLabel="Enhanced"
            />
            <div className="grid grid-cols-2 gap-3">
              <MetricNumber label="PSNR" value={biggestStep.psnr_after} unit=" dB" />
              <MetricNumber label="SSIM" value={biggestStep.ssim_after} unit="" />
            </div>
          </div>
        ) : (
          <div className="skeleton-light aspect-video w-full rounded-3xl" />
        )}
      </StageSection>

      <StageSection title="OCR" complete={hasOcr}>
        {hasOcr ? (
          <div className="space-y-3">
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-black/10 bg-black/5 p-3 font-mono text-xs leading-relaxed text-ink-soft">
              {ocr!.raw_text || "No text extracted."}
            </pre>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-ink-soft">
                <span>Confidence</span>
                <span className="font-mono">{formatPercent(ocr!.confidence)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${ocr!.confidence * 100}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  className="h-full rounded-full bg-accent"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="skeleton-light h-20 w-full rounded-2xl" />
        )}
      </StageSection>

      <StageSection title="Entities" complete={hasGraph}>
        {hasGraph ? (
          Object.keys(entitiesByType).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(entitiesByType).map(([type, nodes]) => (
                <div key={type}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">{type}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {nodes.map((node) => (
                      <span
                        key={node.id}
                        className="rounded-full border px-2.5 py-1 text-xs font-medium"
                        style={{
                          borderColor: `${TYPE_COLORS[type] ?? TYPE_COLORS.OTHER}44`,
                          color: TYPE_COLORS[type] ?? TYPE_COLORS.OTHER,
                          backgroundColor: `${TYPE_COLORS[type] ?? TYPE_COLORS.OTHER}15`,
                        }}
                      >
                        {node.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-soft">No entities extracted from this document.</p>
          )
        ) : (
          <div className="skeleton-light h-16 w-full rounded-2xl" />
        )}
      </StageSection>

      <StageSection title="Graph" complete={hasGraph} isLast>
        {hasGraph && graphData.nodes.length > 0 ? (
          <div className="h-[320px] min-h-[320px] w-full overflow-hidden rounded-3xl border border-black/10 bg-black/5">
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData}
              backgroundColor="transparent"
              nodeLabel={(node: any) => `${node.name} (${node.type})`}
              nodeColor={(node: any) => TYPE_COLORS[node.type] ?? TYPE_COLORS.OTHER}
              nodeRelSize={8}
              linkColor={() => "rgba(26, 26, 26, 0.25)"}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              cooldownTicks={60}
              nodeCanvasObjectMode={() => (showLabels ? "after" : undefined)}
              nodeCanvasObject={
                showLabels
                  ? (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                      const label = node.name as string;
                      const fontSize = 11 / globalScale;
                      ctx.font = `${fontSize}px Inter, sans-serif`;
                      ctx.textAlign = "center";
                      ctx.textBaseline = "top";
                      ctx.fillStyle = "#1A1A1A";
                      ctx.fillText(label, node.x, node.y + 8);
                    }
                  : undefined
              }
            />
          </div>
        ) : hasGraph ? (
          <p className="text-xs text-ink-soft">No relationships found yet.</p>
        ) : (
          <div className="skeleton-light h-[320px] w-full rounded-3xl" />
        )}
      </StageSection>
    </div>
  );
}

function MetricNumber({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="font-mono text-lg font-semibold text-ink">
        <CountUp value={value} decimals={2} suffix={unit} />
      </p>
    </div>
  );
}
