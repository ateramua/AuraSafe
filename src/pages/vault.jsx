// src/pages/vault.jsx
import dynamic from 'next/dynamic';

// ✅ Use the correct Vault component that includes the sidebar
const Vault = dynamic(() => import('../views/Vault'), { ssr: false });

export default function VaultPage() {
  return <Vault />;
}