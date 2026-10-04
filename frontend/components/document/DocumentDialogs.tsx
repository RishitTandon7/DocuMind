"use client";

/** Rename and delete-confirmation sheets for the document view. */

import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/ui/BottomSheet";

interface RenameSheetProps {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export function RenameSheet({ open, initialName, onClose, onSave }: RenameSheetProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const trimmed = name.trim();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      // the caller already showed an error toast; keep the sheet open so the name isn't lost
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Rename document">
      <form onSubmit={submit} className="space-y-3 pb-2">
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          aria-label="Document name"
          className="min-h-[48px] w-full rounded-full bg-white px-5 text-sm text-ink outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-ink/40"
        />
        <button
          type="submit"
          disabled={!trimmed || trimmed === initialName || saving}
          className="min-h-[48px] w-full rounded-full bg-ink text-sm font-semibold text-cream disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </BottomSheet>
  );
}

interface DeleteSheetProps {
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteSheet({ open, name, onClose, onConfirm }: DeleteSheetProps) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Delete this document?">
      <div className="space-y-3 pb-2">
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">{name}</span> and everything extracted from it will be removed for
          good.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="min-h-[48px] flex-1 rounded-full bg-black/5 text-sm font-semibold text-ink">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="min-h-[48px] flex-1 rounded-full bg-[#c0392b] text-sm font-semibold text-white disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
