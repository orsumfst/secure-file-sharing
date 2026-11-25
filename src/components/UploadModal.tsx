import React from "react";
import * as Crypto from "../CryptoUtils";
import { User } from "../types";

interface UploadModalProps {
  user: User;
  users: User[];
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadModalState {
  file: File | null;
  recipientUsername: string;
  loading: boolean;
}

export default class UploadModal extends React.Component<UploadModalProps, UploadModalState> {
  constructor(props: UploadModalProps) {
    super(props);
    this.state = {
      file: null,
      recipientUsername: "",
      loading: false,
    };
  }

  handleUpload = async () => {
    const { file, recipientUsername } = this.state;
    const { user, users, onSuccess } = this.props;
    if (!file) return;
    this.setState({ loading: true });

    try {
      const recipients = [user.id];
      const recipientKeys: { [userId: string]: string } = {};

      if (recipientUsername.trim()) {
        const targetUser = users.find(u => u.username === recipientUsername.trim());
        if (!targetUser) throw new Error(`User "${recipientUsername}" not found`);
        recipients.push(targetUser.id);
      }

      const aesKey = await Crypto.generateFileKey();
      const fileBuffer = await file.arrayBuffer();
      const { ciphertext, iv } = await Crypto.encryptFile(fileBuffer, aesKey);

      for (const uid of recipients) {
        const recipient = uid === user.id ? user : users.find(u => u.id === uid);
        if (recipient?.publicKey) {
          const pubKey = await Crypto.importPublicKey(recipient.publicKey);
          recipientKeys[uid] = await Crypto.wrapFileKey(aesKey, pubKey);
        }
      }

      const metadata = {
        name: file.name,
        size: file.size,
        type: file.type,
        ownerId: user.id,
        ownerName: user.username,
        sharedWith: recipients,
        recipientKeys,
        iv
      };

      const formData = new FormData();
      formData.append("file", new Blob([ciphertext]), file.name);
      formData.append("metadata", JSON.stringify(metadata));

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      this.setState({ loading: false });
    }
  };

  render() {
    const { file, recipientUsername, loading } = this.state;
    return (
      <div className="fixed inset-0 bg-blue-900 flex items-center justify-center z-50 p-4">
        <div className="bg-white border border-blue-600 p-8 max-w-2xl w-full">
          <div className="space-y-6">
            <div 
              className="border-2 border-dashed border-blue-600 p-8 text-center cursor-pointer"
              onClick={() => document.getElementById("fileInput")?.click()}
            >
              <input 
                id="fileInput"
                type="file" 
                className="hidden" 
                onChange={(e) => this.setState({ file: e.target.files?.[0] || null })}
              />
              {file ? (
                <p className="font-bold uppercase tracking-tight">{file.name}</p>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest">Select file to encrypt</p>
                </div>
              )}
            </div>

            <div>
              <input 
                type="text"
                value={recipientUsername}
                onChange={(e) => this.setState({ recipientUsername: e.target.value })}
                placeholder="Recipient Username"
                className="w-full p-3 border border-blue-600 focus:outline-none text-sm font-bold tracking-widest"
              />
            </div>

            <div className="flex gap-4">
              <button 
                onClick={this.props.onClose}
                className="flex-1 border border-blue-600 p-3 font-bold uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={this.handleUpload}
                disabled={!file || loading}
                className="flex-1 bg-blue-600 text-white p-3 font-bold uppercase tracking-widest border border-blue-600"
              >
                {loading ? "Encrypting..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
