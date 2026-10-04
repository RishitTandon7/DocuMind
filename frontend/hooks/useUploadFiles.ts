"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

import { usePendingUpload } from "@/components/providers/PendingUploadProvider";
import { useToast } from "@/components/providers/ToastProvider";

export const MAX_FILE_MB = 25;

/**
 * Optimistic upload of user-chosen files: validates them, shows previews on /document/new immediately, and lets
 * the upload run in the background (see PendingUploadProvider). Several files become one multi-page document.
 */
export function useUploadFiles() {
  const router = useRouter();
  const { toast } = useToast();
  const { start } = usePendingUpload();

  return useCallback(
    (files: File[]) => {
      const usable = files.filter((file) => file.type.startsWith("image/") || file.type === "application/pdf" || /\.(pdf|png|jpe?g|tiff?|bmp|webp|heic)$/i.test(file.name));
      if (usable.length === 0) {
        toast({ message: "Choose an image or a PDF", tone: "error" });
        return;
      }
      const tooBig = usable.find((file) => file.size > MAX_FILE_MB * 1024 * 1024);
      if (tooBig) {
        toast({ message: `${tooBig.name} is larger than ${MAX_FILE_MB} MB`, tone: "error" });
        return;
      }
      const previews = usable.map((file) => (file.type.startsWith("image/") ? URL.createObjectURL(file) : ""));
      start(usable, { previews });
      router.push("/document/new");
    },
    [router, start, toast]
  );
}
