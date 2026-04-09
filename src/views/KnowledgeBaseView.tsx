import { useEffect, useState, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Plus, Trash2, Search, Database,
  Folder, FolderOpen, Loader2, X, ChevronDown,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import type { KnowledgeBase, KbDocument, KbSearchResult } from "@/types";
import {
  listKnowledgeBases,
  createKnowledgeBase,
  deleteKnowledgeBase,
  listKbDocuments,
  indexDocument,
  deleteKbDocument,
  searchKnowledgeBase,
  indexFolder,
} from "@/lib/ipc/invoke";

// ─── Safe snippet renderer ────────────────────────────────────────────────────
// ASVS 5.3.3: Parses ONLY <mark>…</mark> from SQLite FTS5 snippet().
// All other content is React plain text — no HTML injection path.
function SnippetHighlight({ text }: { text: string }) {
  if (!text) return null;
  const parts: Array<{ content: string; mark: boolean }> = [];
  let remaining = text;
  while (remaining) {
    const start = remaining.indexOf("<mark>");
    if (start === -1) { parts.push({ content: remaining, mark: false }); break; }
    if (start > 0) parts.push({ content: remaining.slice(0, start), mark: false });
    const end = remaining.indexOf("</mark>", start + 6);
    if (end === -1) { parts.push({ content: remaining.slice(start + 6), mark: false }); break; }
    parts.push({ content: remaining.slice(start + 6, end), mark: true });
    remaining = remaining.slice(end + 7);
  }
  return (
    <>
      {parts.map((p, i) =>
        p.mark ? (
          <mark key={i} className="bg-violet-500/20 text-violet-200 rounded px-0.5 not-italic font-medium">
            {p.content}
          </mark>
        ) : (
          <span key={i}>{p.content}</span>
        )
      )}
    </>
  );
}

// ─── File type color system ───────────────────────────────────────────────────
const FILE_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  md:   { bg: "bg-sky-950/70",    text: "text-sky-300" },
  rs:   { bg: "bg-orange-950/70", text: "text-orange-300" },
  py:   { bg: "bg-yellow-950/70", text: "text-yellow-200" },
  ts:   { bg: "bg-blue-950/70",   text: "text-blue-300" },
  tsx:  { bg: "bg-cyan-950/70",   text: "text-cyan-300" },
  js:   { bg: "bg-amber-950/70",  text: "text-amber-300" },
  json: { bg: "bg-green-950/70",  text: "text-green-300" },
  toml: { bg: "bg-red-950/70",    text: "text-red-300" },
  yaml: { bg: "bg-violet-950/70", text: "text-violet-300" },
  yml:  { bg: "bg-violet-950/70", text: "text-violet-300" },
  csv:  { bg: "bg-teal-950/70",   text: "text-teal-300" },
};

function fileTypeStyle(ext: string) {
  return FILE_TYPE_STYLES[ext.toLowerCase()] ?? { bg: "bg-zinc-800/80", text: "text-zinc-500" };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function KnowledgeBaseView() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KbDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KbSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [folderIndexResult, setFolderIndexResult] = useState<{ indexed: number; failed: number } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [newKbDesc, setNewKbDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline confirm state — replaces window.confirm() (WCAG 2.1 + security)
  const [pendingDeleteKbId, setPendingDeleteKbId] = useState<number | null>(null);
  const [pendingDeleteDocId, setPendingDeleteDocId] = useState<number | null>(null);

  // Folder dropdown: click-toggle instead of CSS hover (accessible, no accidental triggers)
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  // Close folder menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setShowFolderMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { loadKbs(); }, []);

  useEffect(() => {
    if (selectedKb) loadDocuments(selectedKb.id);
  }, [selectedKb]);

  async function loadKbs() {
    try {
      setLoading(true);
      const data = await listKnowledgeBases();
      setKbs(data);
      if (data.length > 0 && !selectedKb) setSelectedKb(data[0]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments(kbId: number) {
    try {
      const docs = await listKbDocuments(kbId);
      setDocuments(docs);
    } catch {
      setDocuments([]);
    }
  }

  async function handleAddFile() {
    if (!selectedKb) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "지원 파일", extensions: ["txt","md","rs","py","ts","tsx","js","json","toml","yaml","yml","csv"] }],
      });
      if (!selected || typeof selected !== "string") return;
      setIsIndexing(true);
      await indexDocument({ kb_id: selectedKb.id, file_path: selected });
      await loadDocuments(selectedKb.id);
      await loadKbs();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsIndexing(false);
    }
  }

  async function handleAddFolder(recursive: boolean) {
    if (!selectedKb) return;
    setShowFolderMenu(false);
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected || typeof selected !== "string") return;
      setIsIndexing(true);
      setFolderIndexResult(null);
      const result = await indexFolder(selectedKb.id, selected, recursive);
      setFolderIndexResult({ indexed: result.indexed, failed: result.failed });
      await loadDocuments(selectedKb.id);
      await loadKbs();
    } catch (e) {
      setError(String(e));
    } finally {
      setIsIndexing(false);
    }
  }

  async function handleConfirmDeleteDoc(docId: number) {
    try {
      await deleteKbDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setPendingDeleteDocId(null);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const results = await searchKnowledgeBase({
        kb_id: selectedKb?.id,
        query: searchQuery,
        limit: 10,
      });
      setSearchResults(results);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCreateKb() {
    if (!newKbName.trim()) return;
    try {
      const kb = await createKnowledgeBase({ name: newKbName, description: newKbDesc });
      setKbs((prev) => [kb, ...prev]);
      setSelectedKb(kb);
      setShowCreateModal(false);
      setNewKbName("");
      setNewKbDesc("");
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleConfirmDeleteKb(id: number) {
    try {
      await deleteKnowledgeBase(id);
      await loadKbs();
      if (selectedKb?.id === id) { setSelectedKb(null); setDocuments([]); }
      setPendingDeleteKbId(null);
    } catch (e) {
      setError(String(e));
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-50">
      {/* ── Left panel: KB list ─────────────────────────────────── */}
      <aside className="w-56 border-r border-zinc-800/70 flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-zinc-800/70 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
            <span className="text-xs font-semibold text-zinc-200">지식베이스</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50 rounded"
            aria-label="새 지식베이스 만들기"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5" aria-label="지식베이스 목록">
          {loading ? (
            <div role="status" aria-live="polite" className="space-y-1.5 p-1">
              <p className="sr-only">지식베이스 목록을 불러오는 중...</p>
              {[1,2,3].map(i => (
                <div key={i} aria-hidden="true" className="h-11 bg-zinc-800/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : kbs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-3 text-center">
              <Database className="w-8 h-8 text-zinc-800 mb-2" aria-hidden="true" />
              <p className="text-xs text-zinc-500 mb-2">지식베이스 없음</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                + 새로 만들기
              </button>
            </div>
          ) : kbs.map((kb) => {
            const isSelected = selectedKb?.id === kb.id;
            const isPendingDelete = pendingDeleteKbId === kb.id;
            return (
              <div key={kb.id} className="group relative">
                <button
                  onClick={() => { setSelectedKb(kb); setPendingDeleteKbId(null); setPendingDeleteDocId(null); }}
                  className={`w-full text-left px-2.5 py-2.5 rounded-lg transition-colors ${
                    isSelected
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  }`}
                  aria-current={isSelected ? "true" : undefined}
                >
                  {isSelected && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-500 rounded-r" aria-hidden="true" />
                  )}
                  <div className="flex items-center gap-2 min-w-0 pr-5">
                    <span className="truncate text-xs font-medium flex-1">{kb.name}</span>
                    {kb.doc_count > 0 && (
                      <span className="text-[10px] tabular-nums text-zinc-600 shrink-0">
                        {kb.doc_count}
                      </span>
                    )}
                  </div>
                </button>

                {/* Inline delete confirm — replaces window.confirm() */}
                {kb.id !== 1 && (
                  isPendingDelete ? (
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-red-950/40 border border-red-900/30 rounded-lg mx-1 mb-1">
                      <span className="text-[10px] text-red-400 flex-1">삭제?</span>
                      <button
                        onClick={() => handleConfirmDeleteKb(kb.id)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-red-900/60 text-red-300 hover:bg-red-900 transition-colors"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setPendingDeleteKbId(null)}
                        className="text-[10px] px-2 py-0.5 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDeleteKbId(kb.id); }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 rounded-lg hover:bg-zinc-700 text-zinc-600 hover:text-red-400 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                      aria-label={`${kb.name} 삭제`}
                    >
                      <Trash2 className="w-3 h-3" aria-hidden="true" />
                    </button>
                  )
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Right panel ─────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-800/70 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100 truncate">
              {selectedKb ? selectedKb.name : "지식베이스를 선택하세요"}
            </h2>
            {selectedKb?.description && (
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{selectedKb.description}</p>
            )}
          </div>

          {selectedKb && (
            <div className="flex items-center gap-2 shrink-0">
              {/* Indexing result */}
              {folderIndexResult && (
                <span className="text-xs text-zinc-500 whitespace-nowrap">
                  {folderIndexResult.indexed}개 완료
                  {folderIndexResult.failed > 0 && (
                    <span className="text-red-400"> · {folderIndexResult.failed}개 실패</span>
                  )}
                </span>
              )}

              {/* Add file */}
              <button
                onClick={handleAddFile}
                disabled={isIndexing}
                aria-label={isIndexing ? "파일 인덱싱 중…" : "파일 추가"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors disabled:opacity-40 border border-zinc-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
              >
                {isIndexing ? (
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="w-3 h-3" aria-hidden="true" />
                )}
                파일 추가
              </button>

              {/* Folder indexing — click-toggle dropdown */}
              <div className="relative" ref={folderMenuRef}>
                <button
                  onClick={() => setShowFolderMenu((v) => !v)}
                  disabled={isIndexing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-900/30 hover:bg-violet-900/50 text-violet-300 text-xs transition-colors disabled:opacity-40 border border-violet-800/40"
                  aria-expanded={showFolderMenu}
                  aria-haspopup="menu"
                >
                  {showFolderMenu ? (
                    <FolderOpen className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <Folder className="w-3 h-3" aria-hidden="true" />
                  )}
                  폴더 인덱싱
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-150 ${showFolderMenu ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {showFolderMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-zinc-700/60 bg-zinc-900 shadow-2xl z-50 overflow-hidden py-1"
                  >
                    <button
                      role="menuitem"
                      onClick={() => handleAddFolder(false)}
                      className="w-full px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 text-left flex items-start gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                    >
                      <Folder className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" aria-hidden="true" />
                      <div>
                        <div className="font-medium">현재 폴더만</div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">하위 폴더 제외</div>
                      </div>
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => handleAddFolder(true)}
                      className="w-full px-3 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 text-left flex items-start gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" aria-hidden="true" />
                      <div>
                        <div className="font-medium">하위 폴더 포함</div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">최대 200개 파일</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search bar */}
        {selectedKb && (
          <div className="px-5 py-2.5 border-b border-zinc-800/50 flex gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="지식베이스에서 검색… (Enter)"
                maxLength={500}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 rounded-lg focus:border-zinc-600 focus:outline-none placeholder-zinc-700 transition-colors"
                aria-label="지식베이스 검색"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              aria-label={isSearching ? "검색 중…" : "검색"}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors disabled:opacity-40 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Search className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
            {searchResults.length > 0 && (
              <button
                onClick={() => setSearchResults([])}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                aria-label="검색 결과 닫기"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Error banner */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mx-5 mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-950/30 border border-red-900/40 text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="flex-1 text-xs">{error}</span>
              <button
                onClick={() => setError(null)}
                className="shrink-0 hover:text-red-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded"
                aria-label="오류 닫기"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* ── Search results ── */}
          {searchResults.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">
                검색 결과 {searchResults.length}건
              </p>
              <div className="space-y-2">
                {searchResults.map((r) => {
                  const ext = r.filename.split(".").pop() ?? "";
                  const style = fileTypeStyle(ext);
                  return (
                    <div
                      key={r.chunk_id}
                      className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/60 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                          {ext.toUpperCase() || "?"}
                        </span>
                        <span className="text-xs text-zinc-400 font-medium truncate">{r.filename}</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        <SnippetHighlight text={r.snippet} />
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Document list ── */}
          <div className="px-5 pt-4 pb-6">
            {!selectedKb ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Database className="w-10 h-10 text-zinc-800 mb-3" aria-hidden="true" />
                <p className="text-zinc-500 text-sm">왼쪽에서 지식베이스를 선택하세요</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                  <Plus className="w-5 h-5 text-zinc-600" aria-hidden="true" />
                </div>
                <p className="text-zinc-300 text-sm font-medium mb-1.5">문서가 없습니다</p>
                <p className="text-zinc-600 text-xs mb-5 max-w-xs leading-relaxed">
                  파일을 추가하면 AI가 채팅에서 해당 문서를 자동으로 참고합니다
                </p>
                <button
                  onClick={handleAddFile}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors border border-zinc-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  파일 추가하기
                </button>
                <p className="text-[10px] text-zinc-700 mt-4 leading-relaxed">
                  TXT · MD · RS · PY · TS · TSX · JS · JSON · TOML · YAML · CSV
                </p>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">
                  문서 {documents.length}개
                </p>
                <div className="space-y-1.5" role="list" aria-label="문서 목록">
                  {documents.map((doc) => {
                    const style = fileTypeStyle(doc.file_type);
                    const isPending = pendingDeleteDocId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        role="listitem"
                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors"
                      >
                        {/* File type badge */}
                        <span
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl text-[10px] font-mono font-bold shrink-0 ${style.bg} ${style.text}`}
                          aria-label={`${doc.file_type} 파일`}
                        >
                          {doc.file_type.toUpperCase().slice(0, 3)}
                        </span>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-200 truncate">{doc.filename}</div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-0.5 flex-wrap">
                            <span>{formatBytes(doc.file_size)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{doc.chunk_count} 청크</span>
                            {doc.status === "ready" && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="flex items-center gap-0.5 text-green-600">
                                  <CheckCircle2 className="w-2.5 h-2.5" aria-hidden="true" />
                                  인덱싱 완료
                                </span>
                              </>
                            )}
                            {doc.status === "indexing" && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="flex items-center gap-0.5 text-yellow-600">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
                                  처리 중
                                </span>
                              </>
                            )}
                            {doc.status === "error" && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="flex items-center gap-0.5 text-red-500">
                                  <AlertCircle className="w-2.5 h-2.5" aria-hidden="true" />
                                  {doc.error_msg ?? "오류"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Inline delete confirm */}
                        {isPending ? (
                          <div role="alert" className="flex items-center gap-1 shrink-0">
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleConfirmDeleteDoc(doc.id)}
                              aria-label={`${doc.filename} 삭제 확인`}
                              className="text-[11px] px-2 py-1 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                            >
                              삭제
                            </button>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setPendingDeleteDocId(null)}
                              aria-label="삭제 취소"
                              className="text-[11px] px-2 py-1 rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPendingDeleteDocId(doc.id)}
                            className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-red-400 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                            aria-label={`${doc.filename} 삭제`}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* ── Create KB modal ── */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-kb-title"
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateModal(false); setNewKbName(""); setNewKbDesc(""); }}}
        >
          <div className="bg-zinc-900 border border-zinc-700/60 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-5">
              <Database className="w-4 h-4 text-violet-400" aria-hidden="true" />
              <h3 id="create-kb-title" className="text-sm font-semibold text-zinc-100">
                새 지식베이스 만들기
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="kb-name" className="block text-xs text-zinc-500 mb-1.5">
                  이름 <span className="text-red-500" aria-label="필수">*</span>
                </label>
                <input
                  id="kb-name"
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateKb()}
                  placeholder="예: 회사 문서, 개인 메모…"
                  className="w-full px-3 py-2 text-sm bg-zinc-800/80 border border-zinc-700 rounded-xl focus:border-zinc-500 focus:outline-none placeholder-zinc-600 transition-colors"
                  maxLength={100}
                  autoFocus
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="kb-desc" className="block text-xs text-zinc-500 mb-1.5">
                  설명 <span className="text-zinc-700">(선택)</span>
                </label>
                <input
                  id="kb-desc"
                  value={newKbDesc}
                  onChange={(e) => setNewKbDesc(e.target.value)}
                  placeholder="어떤 문서를 모아두는 곳인지 설명하세요"
                  className="w-full px-3 py-2 text-sm bg-zinc-800/80 border border-zinc-700 rounded-xl focus:border-zinc-500 focus:outline-none placeholder-zinc-600 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => { setShowCreateModal(false); setNewKbName(""); setNewKbDesc(""); }}
                className="px-4 py-2 rounded-xl text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateKb}
                disabled={!newKbName.trim()}
                className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
