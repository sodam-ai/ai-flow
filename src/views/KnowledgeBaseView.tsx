import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
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

  useEffect(() => {
    loadKbs();
  }, []);

  useEffect(() => {
    if (selectedKb) {
      loadDocuments(selectedKb.id);
    }
  }, [selectedKb]);

  async function loadKbs() {
    try {
      setLoading(true);
      const data = await listKnowledgeBases();
      setKbs(data);
      if (data.length > 0 && !selectedKb) {
        setSelectedKb(data[0]);
      }
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
        filters: [
          { name: "지원 파일", extensions: ["txt", "md", "rs", "py", "ts", "tsx", "js", "json", "toml", "yaml", "yml", "csv"] },
        ],
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

  async function handleDeleteDoc(docId: number) {
    try {
      await deleteKbDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
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

  async function handleDeleteKb(id: number) {
    if (!confirm("이 지식베이스를 삭제하시겠습니까?")) return;
    try {
      await deleteKnowledgeBase(id);
      await loadKbs();
      if (selectedKb?.id === id) {
        setSelectedKb(null);
        setDocuments([]);
      }
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
      {/* Left panel: KB list */}
      <aside className="w-56 border-r border-zinc-800 flex flex-col">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-200">지식베이스</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="새 지식베이스 만들기"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1,2].map(i => <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />)}
            </div>
          ) : kbs.map((kb) => (
            <button
              key={kb.id}
              onClick={() => setSelectedKb(kb)}
              className={`w-full text-left px-2 py-2 rounded text-sm transition-colors group ${
                selectedKb?.id === kb.id
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate font-medium text-xs">{kb.name}</div>
                  <div className="text-zinc-500 text-xs mt-0.5">{kb.doc_count}개 문서</div>
                </div>
                {kb.id !== 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteKb(kb.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-zinc-600 text-zinc-500 hover:text-red-400 transition-all"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </button>
          ))}
        </nav>
      </aside>

      {/* Right panel: Documents + Search */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              {selectedKb ? selectedKb.name : "지식베이스를 선택하세요"}
            </h2>
            {selectedKb?.description && (
              <p className="text-xs text-zinc-500 mt-0.5">{selectedKb.description}</p>
            )}
          </div>
          {selectedKb && (
            <div className="flex items-center gap-2">
              {/* Folder index result toast */}
              {folderIndexResult && (
                <span className="text-xs text-zinc-500">
                  {folderIndexResult.indexed}개 인덱싱
                  {folderIndexResult.failed > 0 && ` · ${folderIndexResult.failed}개 실패`}
                </span>
              )}
              {/* Add file */}
              <button
                onClick={handleAddFile}
                disabled={isIndexing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors disabled:opacity-50 cursor-pointer border border-zinc-700"
              >
                {isIndexing ? (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                )}
                파일 추가
              </button>
              {/* Folder index dropdown */}
              <div className="relative group">
                <button
                  disabled={isIndexing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-900/40 hover:bg-violet-900/70 text-violet-300 text-xs transition-colors disabled:opacity-50 cursor-pointer border border-violet-700/50"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  폴더 인덱싱
                </button>
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl z-50 overflow-hidden hidden group-hover:block">
                  <button
                    onClick={() => handleAddFolder(false)}
                    disabled={isIndexing}
                    className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 text-left flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-zinc-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    현재 폴더만
                  </button>
                  <button
                    onClick={() => handleAddFolder(true)}
                    disabled={isIndexing}
                    className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 text-left flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-zinc-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                    하위 폴더 포함 (재귀)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search bar */}
        {selectedKb && (
          <div className="px-4 py-3 border-b border-zinc-800 flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="지식베이스에서 검색..."
              className="flex-1 px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded focus:border-zinc-500 focus:outline-none placeholder-zinc-600"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSearching ? "검색 중..." : "검색"}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 p-3 rounded bg-red-900/20 border border-red-800 text-red-400 text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline cursor-pointer">닫기</button>
            </div>
          )}

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-xs font-medium text-zinc-400 uppercase mb-3">
                검색 결과 ({searchResults.length}건)
              </h3>
              <div className="space-y-2">
                {searchResults.map((r) => (
                  <div key={r.chunk_id} className="p-3 rounded bg-zinc-800/50 border border-zinc-700">
                    <div className="flex items-center gap-2 mb-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs text-zinc-400 font-medium">{r.filename}</span>
                    </div>
                    <p
                      className="text-xs text-zinc-300 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: r.snippet }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents list */}
          <div className="p-4">
            {!selectedKb ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-zinc-700 mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
                <p className="text-zinc-500 text-sm">왼쪽에서 지식베이스를 선택하세요</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-zinc-700 mb-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-zinc-400 text-sm font-medium mb-1">문서가 없습니다</p>
                <p className="text-zinc-600 text-xs">위의 "파일 추가" 버튼으로 문서를 인덱싱하세요</p>
                <p className="text-zinc-600 text-xs mt-1">지원 형식: TXT, MD, RS, PY, TS, JS, JSON, TOML, YAML, CSV</p>
              </div>
            ) : (
              <>
                <h3 className="text-xs font-medium text-zinc-400 uppercase mb-3">
                  문서 ({documents.length}개)
                </h3>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 rounded bg-zinc-900 border border-zinc-800 group"
                    >
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded text-xs font-mono font-bold ${
                          doc.status === "ready" ? "bg-green-900/30 text-green-400" :
                          doc.status === "indexing" ? "bg-yellow-900/30 text-yellow-400" :
                          doc.status === "error" ? "bg-red-900/30 text-red-400" :
                          "bg-zinc-800 text-zinc-500"
                        }`}>
                          {doc.file_type.toUpperCase().slice(0, 3)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-200 truncate">{doc.filename}</div>
                        <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                          <span>{formatBytes(doc.file_size)}</span>
                          <span>·</span>
                          <span>{doc.chunk_count} 청크</span>
                          {doc.status === "ready" && (
                            <>
                              <span>·</span>
                              <span className="text-green-500">인덱싱 완료</span>
                            </>
                          )}
                          {doc.status === "error" && (
                            <>
                              <span>·</span>
                              <span className="text-red-400">{doc.error_msg}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Create KB Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-100 mb-4">새 지식베이스 만들기</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">이름 *</label>
                <input
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  placeholder="예: 회사 문서"
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded focus:border-zinc-500 focus:outline-none"
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">설명</label>
                <input
                  value={newKbDesc}
                  onChange={(e) => setNewKbDesc(e.target.value)}
                  placeholder="선택 사항"
                  className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleCreateKb}
                disabled={!newKbName.trim()}
                className="px-4 py-2 rounded bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
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
