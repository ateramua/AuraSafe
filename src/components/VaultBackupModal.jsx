import React, { useState, useEffect } from 'react';
import { useVaultBackup } from '../lib/vault-backup-api';

const VaultBackupModal = ({ isOpen, onClose }) => {
  const { exportVault, importVault, previewVault } = useVaultBackup();
  const [activeTab, setActiveTab] = useState('export');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importMode, setImportMode] = useState('merge');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleExport = async () => {
    if (!password) {
      setMessage('Please enter a password');
      return;
    }

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await exportVault(password);
      setMessage(`✅ Vault exported successfully! ${result.entriesCount} entries saved.`);
      setPassword('');
    } catch (error) {
      setMessage(`❌ Export failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!password) {
      setMessage('Please enter the backup password');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await importVault(password, { mode: importMode });
      setMessage(`✅ Vault imported successfully! ${result.imported} entries added.`);
      setPassword('');
      // Optionally refresh the vault data in parent component
    } catch (error) {
      setMessage(`❌ Import failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!password) {
      setMessage('Please enter the backup password');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const result = await previewVault(password);
      setPreview(result.preview);
      setMessage('✅ Preview loaded successfully');
    } catch (error) {
      setMessage(`❌ Preview failed: ${error.message}`);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setMessage('');
    setPreview(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Vault Backup</h2>
          <button
            type="button"
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-4 border-b">
          <button
            className={`px-4 py-2 ${activeTab === 'export' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            onClick={() => {
              setActiveTab('export');
              resetForm();
            }}
          >
            Export
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'import' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            onClick={() => {
              setActiveTab('import');
              resetForm();
            }}
          >
            Import
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'preview' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            onClick={() => {
              setActiveTab('preview');
              resetForm();
            }}
          >
            Preview
          </button>
        </div>

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Backup Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Enter strong password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Confirm password"
              />
            </div>
            <button
              onClick={handleExport}
              disabled={loading || password !== confirmPassword || !password}
              className="w-full bg-blue-600 text-white py-2 rounded disabled:bg-gray-400"
            >
              {loading ? 'Exporting...' : 'Export Vault'}
            </button>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Backup Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Enter backup password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Import Mode</label>
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="merge">Merge (recommended)</option>
                <option value="replace">Replace all data</option>
              </select>
            </div>
            <button
              onClick={handleImport}
              disabled={loading || !password}
              className="w-full bg-green-600 text-white py-2 rounded disabled:bg-gray-400"
            >
              {loading ? 'Importing...' : 'Import Vault'}
            </button>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Backup Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="Enter backup password"
              />
            </div>
            <button
              onClick={handlePreview}
              disabled={loading || !password}
              className="w-full bg-purple-600 text-white py-2 rounded disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Preview Backup'}
            </button>
            {preview && (
              <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                <p><strong>Version:</strong> {preview.version}</p>
                <p><strong>Export Date:</strong> {new Date(preview.exportDate).toLocaleString()}</p>
                <p><strong>Entries:</strong> {preview.entriesCount}</p>
                <p><strong>Categories:</strong> {preview.categoriesCount}</p>
              </div>
            )}
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`mt-4 p-3 rounded text-sm ${message.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default VaultBackupModal;