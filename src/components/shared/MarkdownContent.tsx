import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  content: string;
}

export default function MarkdownContent({ content }: Props) {
  return (
    <div className="text-sm leading-relaxed max-w-none">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks with copy button
        code({ className, children, ...props }) {
          const isBlock = className?.startsWith("language-");
          if (isBlock) {
            return (
              <CodeBlock language={className?.replace("language-", "") ?? ""}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          }
          return (
            <code
              className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 text-xs font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        // Block elements
        pre({ children }) {
          return <>{children}</>;
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>;
        },
        li({ children }) {
          return <li className="text-zinc-200">{children}</li>;
        },
        h1({ children }) {
          return <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>;
        },
        strong({ children }) {
          return <strong className="font-semibold text-zinc-100">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic text-zinc-300">{children}</em>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-zinc-700 pl-3 my-2 text-zinc-400 italic">
              {children}
            </blockquote>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              {children}
            </a>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="text-xs border-collapse w-full">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-zinc-700 px-2 py-1 bg-zinc-800/50 text-left font-medium">
              {children}
            </th>
          );
        },
        td({ children }) {
          return <td className="border border-zinc-700 px-2 py-1">{children}</td>;
        },
        hr() {
          return <hr className="border-zinc-800 my-3" />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ children, language }: { children: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative my-2 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-800/50 text-[10px]">
        <span className="text-zinc-500 font-mono">{language || "text"}</span>
        <button
          onClick={handleCopy}
          aria-label={copied ? "코드 복사됨" : "코드 복사"}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50 rounded"
        >
          {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code className="text-xs font-mono text-zinc-300 leading-relaxed">{children}</code>
      </pre>
    </div>
  );
}
