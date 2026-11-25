/**
 * @license

 */

import React from "react";
import { User } from "./types";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";

interface AppState {
  user: User | null;
  privateKey: CryptoKey | null;
  view: "login" | "register" | "dashboard";
  loading: boolean;
}

export default class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      user: null,
      privateKey: null,
      view: "login",
      loading: false,
    };
  }

  componentDidMount() {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      this.setState({
        user: JSON.parse(savedUser),
        view: "dashboard",
      });
    }
  }

  handleLogout = () => {
    this.setState({
      user: null,
      privateKey: null,
      view: "login",
    });
    localStorage.removeItem("user");
  };

  render() {
    const { user, privateKey, view, loading } = this.state;

    return (
      <div className="min-h-screen bg-white text-black font-sans">
        {user && (
          <header className="border-b border-gray-200 p-4 flex justify-between items-center">
            <div 
              className="flex items-center gap-2 font-bold text-xl cursor-pointer"
              onClick={() => this.setState({ view: "dashboard" })}
            >
              SECURESHARE
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium uppercase tracking-widest opacity-50">
                  {user.username} ({user.role})
                </span>
                <button 
                  onClick={this.handleLogout}
                  className="p-2 border border-gray-300 text-xs font-bold uppercase"
                  title="Logout"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>
        )}

        <main className={user ? "max-w-7xl mx-auto p-8" : "min-h-[80vh] flex items-center justify-center p-8"}>
          {view === "login" && (
            <Login 
              onLogin={(u, pk) => this.setState({ user: u, privateKey: pk, view: "dashboard" })}
              onSwitch={() => this.setState({ view: "register" })}
            />
          )}
          {view === "register" && (
            <Register 
              onRegister={(u, pk) => this.setState({ user: u, privateKey: pk, view: "dashboard" })}
              onSwitch={() => this.setState({ view: "login" })}
            />
          )}
          {view === "dashboard" && user && (
            <Dashboard 
              user={user}
              privateKey={privateKey}
            />
          )}
        </main>

        {loading && (
          <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
            <div className="text-xs font-bold uppercase tracking-widest">Loading...</div>
          </div>
        )}
      </div>
    );
  }
}
