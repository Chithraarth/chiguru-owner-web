import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { reportError } from "@/lib/error-report";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Safety net: if any screen crashes while rendering, the farmer sees a calm
// "try again" screen instead of a frozen/blank page, and the error is reported
// automatically so it can be fixed.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError({
      message: error.message || "Render error",
      stack: `${error.stack || ""}\n--- component stack ---${info.componentStack || ""}`,
      source: "boundary",
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-background">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-primary">
            Something went wrong
          </h1>
          <p className="text-sm text-primary/80">कुछ गड़बड़ हुई — फिर से कोशिश करें</p>
          <p className="text-sm text-gray-600 pt-1">
            Don’t worry — your saved data is safe.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground active:bg-primary/90"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-5 py-2.5 text-sm font-medium text-primary active:bg-primary/10"
          >
            <RotateCcw className="w-4 h-4" />
            Restart
          </button>
        </div>
      </div>
    );
  }
}
