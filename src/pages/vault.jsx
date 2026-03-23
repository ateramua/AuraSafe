// src/pages/vault.jsx
import dynamic from 'next/dynamic';

const Vault = dynamic(() => import('../components/Vault'), { ssr: false });

export default function VaultPage() {
  return <Vault />;
}
