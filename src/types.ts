export interface User {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
  publicKey?: string;
}

export interface FileMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  ownerId: string;
  ownerName: string;
  sharedWith: string[];
  recipientKeys: { [userId: string]: string };
  iv: string;
  timestamp: string;
}
