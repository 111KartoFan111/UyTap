import React from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error to service
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-content">
            <FiAlertTriangle size={48} className="error-icon" />
            <h2>Что-то пошло не так</h2>
            <p>Произошла ошибка в приложении. Пожалуйста, обновите страницу.</p>
            
            <div className="error-actions">
              <button 
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
                <FiRefreshCw />
                Обновить страницу
              </button>
              
              <button 
                className="btn-outline"
                onClick={() => this.setState({ hasError: false })}
              >
                Попробовать снова
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Детали ошибки (только для разработки)</summary>
                <pre>{this.state.error && this.state.error.toString()}</pre>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;