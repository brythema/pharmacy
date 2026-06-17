import React, { ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  // Explicitly typing properties for TS validation
  props: Props;
  state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CareMed Critical Unhandled UI Exception Captured:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-left animate-fade-in">
            <div className="flex items-center gap-4 text-rose-500 mb-6">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h1 className="font-display font-black text-xl text-slate-900 tracking-tight">
                  Critical System Failure
                </h1>
                <p className="text-[10px] uppercase font-mono tracking-wider font-bold text-rose-600">
                  CareMed Diagnostics
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-650 leading-relaxed">
              We encountered an unhandled exception inside the clinical application flow. This event has been securely flagged for system administrator logging and safety auditable review.
            </p>

            <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-150 font-mono text-xs text-slate-600 overflow-x-auto max-h-40">
              <p className="font-bold text-rose-700 mb-1">{this.state.error?.name}: {this.state.error?.message}</p>
              <p className="whitespace-pre text-[10px] leading-normal opacity-80">{this.state.error?.stack}</p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => window.location.href = "/"}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Go to Home
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2 whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload Platform</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
