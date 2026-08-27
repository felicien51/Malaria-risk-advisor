import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Logged for local debugging; not sent anywhere.
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="state-box">
          <p>Something went wrong loading this page.</p>
          <button className="retry-btn" onClick={() => window.location.assign("/")}>
            Back to home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
