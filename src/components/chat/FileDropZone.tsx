import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { validateAndReadFile } from "@/lib/ipc/invoke";
import { useToastStore } from "@/stores/toastStore";
import type { FileContent } from "@/types";
import { File, Image, X } from "lucide-react";

interface Props {
  children: ReactNode;
  attachments: FileContent[];
  onAttachmentsChange: (files: FileContent[]) => void;
}

export default function FileDropZone({
  children,
  attachments,
  onAttachmentsChange,
}: Props) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Listen for Tauri drag-drop events
    const unlistenDrop = listen<{ paths: string[] }>(
      "tauri://drag-drop",
      async (event) => {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (!paths?.length) return;

        const newFiles: FileContent[] = [];
        for (const path of paths) {
          try {
            const file = await validateAndReadFile(path);
            newFiles.push(file);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            useToastStore.getState().addToast("error", msg);
          }
        }

        if (newFiles.length > 0) {
          onAttachmentsChange([...attachments, ...newFiles]);
        }
      },
    );

    const unlistenHover = listen("tauri://drag-enter", () => setIsDragging(true));
    const unlistenLeave = listen("tauri://drag-leave", () => setIsDragging(false));

    return () => {
      unlistenDrop.then((fn) => fn());
      unlistenHover.then((fn) => fn());
      unlistenLeave.then((fn) => fn());
    };
  }, [attachments, onAttachmentsChange]);

  const removeFile = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="relative">
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-900/80 border-2 border-dashed border-zinc-500 rounded-lg">
          <p className="text-sm text-zinc-300">{t("fileDrop.dropHere")}</p>
        </div>
      )}

      {/* File attachment chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300"
            >
              {file.info.is_image ? (
                <Image className="w-3 h-3 text-zinc-500" />
              ) : (
                <File className="w-3 h-3 text-zinc-500" />
              )}
              <span className="max-w-[120px] truncate">{file.info.name}</span>
              <span className="text-zinc-600">{formatSize(file.info.size)}</span>
              <button
                onClick={() => removeFile(i)}
                className="ml-0.5 hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
