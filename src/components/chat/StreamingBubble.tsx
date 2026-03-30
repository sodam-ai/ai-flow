import MarkdownContent from "@/components/shared/MarkdownContent";

interface Props {
  content: string;
}

export default function StreamingBubble({ content }: Props) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-zinc-800/50 text-zinc-100">
        {content ? (
          <MarkdownContent content={content} />
        ) : (
          <p className="text-sm text-zinc-400">Thinking...</p>
        )}
        <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse ml-0.5 align-text-bottom" />
      </div>
    </div>
  );
}
