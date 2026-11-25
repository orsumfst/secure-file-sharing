import React from "react";
import * as Crypto from "../CryptoUtils";
import { User, FileMeta } from "../types";
import UploadModal from "./UploadModal";

interface DashboardProps {
  user: User;
  privateKey: CryptoKey | null;
}

interface DashboardState {
  files: FileMeta[];
  users: User[];
  loading: boolean;
  showUpload: boolean;
}

export default class Dashboard extends React.Component<DashboardProps, DashboardState> {
  constructor(props: DashboardProps) {
    super(props);
    this.state = {
      files: [],
      users: [],
      loading: false,
      showUpload: false,
    };
  }

  componentDidMount() {
    this.fetchFiles();
    this.fetchUsers();
  }

  fetchFiles = async () => {
    try {
      const res = await fetch(`/api/files/${this.props.user.id}`);
      const data = await res.json();
      this.setState({ files: data });
    } catch (err) {
      console.error("Failed to fetch files", err);
    }
  };

  fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      this.setState({ users: data.filter((u: User) => u.id !== this.props.user.id) });
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  handleDownload = async (file: FileMeta) => {
    const { privateKey, user } = this.props;
    if (!privateKey) return;

    this.setState({ loading: true });
    try {
      const res = await fetch(`/api/download/${file.id}/${user.id}`);
      const encryptedBlob = await res.blob();
      const encryptedData = await encryptedBlob.arrayBuffer();

      const wrappedKey = file.recipientKeys[user.id];
      if (!wrappedKey) throw new Error("No access key found for you");
      
      const aesKey = await Crypto.unwrapFileKey(wrappedKey, privateKey);
      const decryptedData = await Crypto.decryptFile(encryptedData, file.iv, aesKey);

      const blob = new Blob([decryptedData], { type: file.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Download failed: " + err.message);
    } finally {
      this.setState({ loading: false });
    }
  };

  render() {
    const { files, users, loading, showUpload } = this.state;
    const { user, privateKey } = this.props;

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div></div>
          <button 
            onClick={() => this.setState({ showUpload: true })}
            className="bg-blue-600 text-white px-6 py-3 font-bold uppercase tracking-widest border border-blue-600"
          >
            Upload
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {files.length === 0 ? (
            <div className="col-span-full p-12 text-center">
              <p className="text-xs font-bold uppercase tracking-widest opacity-30">No files shared yet</p>
            </div>
          ) : (
            files.map((file) => (
              <div 
                key={file.id}
                className="border border-blue-600 p-4"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-bold uppercase border border-black px-1 py-0.5 inline-block w-fit">File</div>
                    {file.ownerId === user.id ? (
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">Sent</span>
                    ) : (
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">From: {file.ownerName}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                      {new Date(file.timestamp).toLocaleDateString()}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <h3 className="font-bold uppercase tracking-tight truncate mb-4" title={file.name}>
                  {file.name}
                </h3>
                <button 
                  onClick={() => this.handleDownload(file)}
                  disabled={!privateKey}
                  className="w-full border border-blue-600 p-2 text-xs font-bold uppercase tracking-widest"
                >
                  Download
                </button>
              </div>
            ))
          )}
        </div>

        {showUpload && (
          <UploadModal 
            user={user} 
            users={users} 
            onClose={() => this.setState({ showUpload: false })} 
            onSuccess={() => {
              this.setState({ showUpload: false });
              this.fetchFiles();
            }}
          />
        )}

        {loading && (
          <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
            <div className="text-xs font-bold uppercase tracking-widest">Processing...</div>
          </div>
        )}
      </div>
    );
  }
}
