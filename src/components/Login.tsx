import React from "react";
import { User } from "../types";
import * as Crypto from "../CryptoUtils";

interface LoginProps {
  onLogin: (u: User, pk: CryptoKey | null) => void;
  onSwitch: () => void;
}

interface LoginState {
  username: string;
  password: string;
  error: string | null;
  loading: boolean;
}

export default class Login extends React.Component<LoginProps, LoginState> {
  constructor(props: LoginProps) {
    super(props);
    this.state = {
      username: "",
      password: "",
      error: null,
      loading: false,
    };
  }

  handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { username, password } = this.state;
    this.setState({ loading: true, error: null });

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      let pk: CryptoKey | null = null;
      const localKeyData = localStorage.getItem(`key_${username}`);
      
      if (localKeyData) {
        const { encryptedPrivateKey, salt: saltBase64 } = JSON.parse(localKeyData);
        
        // Össze kombinálni az encryptedPrivateKey és salt-ot
        const encryptedData = {
          ...encryptedPrivateKey,
          salt: saltBase64
        };
        
        // JAVÍTVA: Jelszót adunk át, nem a levezetett kulcsot
        const privateKeyBase64 = await Crypto.decryptPrivateKey(encryptedData, password);
        pk = await Crypto.importPrivateKey(privateKeyBase64);
      }

      localStorage.setItem("user", JSON.stringify(data));
      this.props.onLogin(data, pk);
    } catch (err: any) {
      this.setState({ error: err.message });
    } finally {
      this.setState({ loading: false });
    }
  };

  render() {
    const { username, password, error, loading } = this.state;
    
    return (
      <div className="space-y-4">
        <form onSubmit={this.handleSubmit} className="space-y-2">
          <div>
            <input 
              type="text" 
              value={username}
              onChange={(e) => this.setState({ username: e.target.value })}
              placeholder="Username"
              className="w-full p-1 border-b border-gray-300 focus:outline-none"
              required
            />
          </div>
          
          <div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => this.setState({ password: e.target.value })}
              placeholder="Password"
              className="w-full p-1 border-b border-gray-300 focus:outline-none"
              required
            />
          </div>
          
          {error && <p className="text-xs text-red-500">{error}</p>}
          
          <button 
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-1 text-sm"
          >
            {loading ? "..." : "Login"}
          </button>
        </form>
        
        <button 
          onClick={this.props.onSwitch}
          className="text-xs opacity-50 block"
        >
          Register
        </button>
      </div>
    );
  }
}