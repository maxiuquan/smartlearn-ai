import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">页面出现异常</h2>
          <p className="text-sm text-gray-500 mb-6 text-center max-w-md">
            {this.state.error?.message || '发生了未知错误，请尝试刷新页面'}
          </p>
          <button
            onClick={this.handleReset}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={16} />
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}