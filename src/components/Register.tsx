import React from "react";
import * as Crypto from "../CryptoUtils";
import { User } from "../types";

interface RegisterProps {
  onRegister: (u: User, pk: CryptoKey) => void;
  onSwitch: () => void;
}

interface RegisterState {
  username: string;
  password: string;
  error: string | null;
  loading: boolean;
}

export default class Register extends React.Component<RegisterProps, RegisterState> {
  constructor(props: RegisterProps) {
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
      const keyPair = await Crypto.generateKeyPair();
      const publicKeyBase64 = await Crypto.exportPublicKey(keyPair.publicKey);
      const privateKeyBase64 = await Crypto.exportPrivateKey(keyPair.privateKey);

      // JAVÍTVA: Közvetlenül jelszót adunk, az encryptPrivateKey gondoskodik a sóról
      const encryptedPrivateKey = await Crypto.encryptPrivateKey(privateKeyBase64, password);

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username, 
          password, 
          publicKey: publicKeyBase64,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      // Az encryptedPrivateKey már tartalmazza a sót
      localStorage.setItem(`key_${username}`, JSON.stringify(encryptedPrivateKey));

      localStorage.setItem("user", JSON.stringify(data));
      this.props.onRegister(data, keyPair.privateKey);
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
            {loading ? "..." : "Register"}
          </button>
        </form>
        <button 
          onClick={this.props.onSwitch}
          className="text-xs opacity-50 block"
        >
          Login
        </button>
      </div>
    );
  }
}