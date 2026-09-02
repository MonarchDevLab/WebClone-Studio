import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary yakaladı:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] h-full p-8 text-center bg-canvas text-text-primary select-none">
          <div className="p-3 bg-error/10 border border-error/20 rounded-2xl text-error-hover mb-4 shadow-lg shadow-error/10">
            <AlertTriangle size={32} />
          </div>
          
          <h2 className="text-base font-bold text-text-primary mb-1">
            Beklenmeyen Bir Görsel Hata Oluştu
          </h2>
          
          <p className="text-xs text-text-muted max-w-md mb-4 leading-relaxed">
            Arayüz bileşeni render edilirken bir hata yakalandı. Uygulama çökmesi önlendi.
          </p>

          {this.state.error && (
            <div className="w-full max-w-lg p-3 bg-surface-2 border border-white/[0.08] rounded-xl text-left font-mono text-[11px] text-error-hover mb-5 overflow-x-auto">
              <div className="font-bold text-error-hover mb-1">{this.state.error.name}: {this.state.error.message}</div>
              <div className="text-text-dim text-[10px] whitespace-pre-wrap">{this.state.error.stack}</div>
            </div>
          )}

          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-black rounded-lg text-xs font-bold transition-all shadow-lg shadow-accent/20 active:scale-95"
          >
            <RefreshCw size={14} />
            <span>Sayfayı Yeniden Yükle</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
