import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Which pipeline stage this boundary wraps, shown in the fallback so a user can tell
   * "retrieval failed" from "generation failed" instead of a generic crash message. */
  stage: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Medical-safe error boundary: on failure, shows which stage failed rather than
 * crashing silently or (worse) letting a partial/corrupt render imply a valid result.
 * No result is better than an unverified one.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.stage}] caught:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-start gap-3">
          <AlertOctagon size={20} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-400">
              {this.props.stage} could not be completed
            </p>
            <p className="text-xs text-brand-mint/60 mt-1">
              This section could not be generated. No result is better than an unverified one.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
