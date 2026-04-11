import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Displayed in error UI — e.g. "설정" */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches render-time errors in child components so one broken view
 * cannot freeze the entire app. Tauri IPC / async errors are NOT caught here
 * (those must be handled per-call); only synchronous render panics land here.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: unknown): State {
    const message =
      err instanceof Error ? err.message : String(err ?? "알 수 없는 오류");
    return { hasError: true, message };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", err, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-500">
        <AlertTriangle className="w-8 h-8 text-red-500/70" />
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-300">
            {this.props.label ? `${this.props.label} 화면에서 오류가 발생했습니다` : "화면을 불러오는 중 오류가 발생했습니다"}
          </p>
          <p className="text-xs mt-1 text-zinc-600 max-w-xs">
            {this.state.message}
          </p>
        </div>
        <button
          onClick={this.reset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          다시 시도
        </button>
      </div>
    );
  }
}
