'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/portal/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center gap-5">
          <div className="text-[52px]">⚠️</div>
          <div>
            <h2 className="font-serif text-[20px] font-bold text-[var(--color-ink)] mb-1">
              Something went wrong
            </h2>
            <p className="text-[13px] text-[var(--color-muted)] max-w-sm">
              An unexpected error occurred. Your data is safe — please try returning
              to the dashboard.
            </p>
          </div>
          {this.state.error && (
            <div className="text-[11px] font-mono bg-[var(--color-canvas)] text-[var(--color-slate)] px-4 py-2 rounded-xl border border-[var(--color-line)] max-w-md overflow-auto text-left">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="px-6 py-2.5 bg-[var(--color-teal)] text-white font-bold text-[14px] rounded-xl hover:opacity-90 transition-opacity"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
