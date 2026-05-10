// electron/backup/backup-manager.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dialog } from 'electron';

const BACKUP_VERSION = '1.0';
const BACKUP_EXTENSION = '.aura';

class BackupManager {
    constructor(vaultKey, masterPassword) {
        this.vaultKey = vaultKey;
        this.masterPassword = masterPassword;
    }

    // ========== LAYER 3: Manual Export ==========
    
    // Export encrypted vault to user-selected location
    async exportToFile(vaultData) {
        const { filePath } = await dialog.showSaveDialog({
            title: 'Export Vault Backup',
            defaultPath: `AuraSafe_Backup_${this.getDateString()}.aura`,
            filters: [
                { name: 'AuraSafe Backup', extensions: ['aura'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!filePath) {
            return { success: false, cancelled: true };
        }

        try {
            // Create backup container
            const backupContainer = {
                version: BACKUP_VERSION,
                timestamp: Date.now(),
                data: this.encryptBackupData(vaultData),
                checksum: null
            };
            
            // Calculate checksum for integrity verification
            const backupString = JSON.stringify(backupContainer.data);
            backupContainer.checksum = crypto
                .createHash('sha256')
                .update(backupString)
                .digest('hex');
            
            // Write to file
            fs.writeFileSync(filePath, JSON.stringify(backupContainer, null, 2));
            
            return { 
                success: true, 
                filePath,
                message: `Backup saved to: ${filePath}`
            };
        } catch (error) {
            console.error('[Backup] Export failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Import from backup file
    async importFromFile() {
        const { filePaths } = await dialog.showOpenDialog({
            title: 'Import Vault Backup',
            filters: [
                { name: 'AuraSafe Backup', extensions: ['aura'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });

        if (!filePaths || filePaths.length === 0) {
            return { success: false, cancelled: true };
        }

        const filePath = filePaths[0];

        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const backupContainer = JSON.parse(fileContent);
            
            // Verify version compatibility
            if (backupContainer.version !== BACKUP_VERSION) {
                throw new Error(`Incompatible backup version: ${backupContainer.version}`);
            }
            
            // Verify checksum
            const backupString = JSON.stringify(backupContainer.data);
            const calculatedChecksum = crypto
                .createHash('sha256')
                .update(backupString)
                .digest('hex');
            
            if (calculatedChecksum !== backupContainer.checksum) {
                throw new Error('Backup file corrupted or tampered with');
            }
            
            // Decrypt the backup data
            const decryptedData = this.decryptBackupData(backupContainer.data);
            
            return { 
                success: true, 
                data: decryptedData,
                timestamp: backupContainer.timestamp
            };
        } catch (error) {
            console.error('[Backup] Import failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Find all backup files in user's documents
    async findBackupFiles() {
        const documentsPath = app.getPath('documents');
        const backupsDir = path.join(documentsPath, 'AuraSafe Backups');
        
        if (!fs.existsSync(backupsDir)) {
            return [];
        }
        
        const files = fs.readdirSync(backupsDir);
        const backupFiles = files
            .filter(f => f.endsWith(BACKUP_EXTENSION))
            .map(f => ({
                path: path.join(backupsDir, f),
                name: f,
                modified: fs.statSync(path.join(backupsDir, f)).mtime
            }))
            .sort((a, b) => b.modified - a.modified);
        
        return backupFiles;
    }

    // ========== LAYER 2: iCloud Backup ==========
    
    // Check if iCloud is available
    async isICloudAvailable() {
        try {
            // Check if iCloud drive is accessible
            const iCloudPath = path.join(app.getPath('home'), 'Library', 'Mobile Documents');
            return fs.existsSync(iCloudPath);
        } catch (error) {
            return false;
        }
    }

    // Get iCloud backup directory
    getICloudBackupPath() {
        return path.join(
            app.getPath('home'),
            'Library',
            'Mobile Documents',
            'com~apple~CloudDocs',
            'AuraSafe Backups'
        );
    }

    // Upload encrypted backup to iCloud
    async backupToICloud(vaultData) {
        const iCloudAvailable = await this.isICloudAvailable();
        
        if (!iCloudAvailable) {
            return { 
                success: false, 
                error: 'iCloud Drive not available. Please enable iCloud Drive in System Settings.'
            };
        }

        const iCloudBackupDir = this.getICloudBackupPath();
        
        // Create backup directory in iCloud
        if (!fs.existsSync(iCloudBackupDir)) {
            fs.mkdirSync(iCloudBackupDir, { recursive: true });
        }

        const backupFileName = `AuraSafe_Cloud_${this.getDateString()}.aura`;
        const backupPath = path.join(iCloudBackupDir, backupFileName);

        try {
            // Create backup container
            const backupContainer = {
                version: BACKUP_VERSION,
                timestamp: Date.now(),
                deviceName: require('os').hostname(),
                data: this.encryptBackupData(vaultData),
                checksum: null
            };
            
            // Calculate checksum
            const backupString = JSON.stringify(backupContainer.data);
            backupContainer.checksum = crypto
                .createHash('sha256')
                .update(backupString)
                .digest('hex');
            
            // Write to iCloud
            fs.writeFileSync(backupPath, JSON.stringify(backupContainer, null, 2));
            
            // Keep only last 10 backups
            await this.cleanupOldICloudBackups(iCloudBackupDir, 10);
            
            return { 
                success: true, 
                path: backupPath,
                message: 'Backup saved to iCloud Drive'
            };
        } catch (error) {
            console.error('[Backup] iCloud backup failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Restore from iCloud
    async restoreFromICloud() {
        const iCloudBackupDir = this.getICloudBackupPath();
        
        if (!fs.existsSync(iCloudBackupDir)) {
            return { success: false, error: 'No iCloud backups found' };
        }

        // Get all backup files
        const backupFiles = fs.readdirSync(iCloudBackupDir)
            .filter(f => f.endsWith(BACKUP_EXTENSION))
            .map(f => ({
                path: path.join(iCloudBackupDir, f),
                name: f,
                modified: fs.statSync(path.join(iCloudBackupDir, f)).mtime
            }))
            .sort((a, b) => b.modified - a.modified);

        if (backupFiles.length === 0) {
            return { success: false, error: 'No backup files found in iCloud' };
        }

        // Use the latest backup
        const latestBackup = backupFiles[0];

        try {
            const fileContent = fs.readFileSync(latestBackup.path, 'utf-8');
            const backupContainer = JSON.parse(fileContent);
            
            // Verify checksum
            const backupString = JSON.stringify(backupContainer.data);
            const calculatedChecksum = crypto
                .createHash('sha256')
                .update(backupString)
                .digest('hex');
            
            if (calculatedChecksum !== backupContainer.checksum) {
                throw new Error('Backup file corrupted or tampered with');
            }
            
            const decryptedData = this.decryptBackupData(backupContainer.data);
            
            return { 
                success: true, 
                data: decryptedData,
                timestamp: backupContainer.timestamp,
                backupDate: new Date(backupContainer.timestamp).toLocaleString()
            };
        } catch (error) {
            console.error('[Backup] iCloud restore failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Clean up old iCloud backups, keeping only the most recent 'keep'
    async cleanupOldICloudBackups(directory, keep) {
        const files = fs.readdirSync(directory)
            .filter(f => f.endsWith(BACKUP_EXTENSION))
            .map(f => ({
                name: f,
                path: path.join(directory, f),
                mtime: fs.statSync(path.join(directory, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);

        // Delete excess files
        for (let i = keep; i < files.length; i++) {
            fs.unlinkSync(files[i].path);
            console.log(`[Backup] Removed old backup: ${files[i].name}`);
        }
    }

    // ========== Encryption Helpers ==========
    
    encryptBackupData(data) {
        // Generate a random salt and IV
        const salt = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        
        // Derive key from master password
        const key = crypto.pbkdf2Sync(
            this.masterPassword,
            salt,
            100000,
            32,
            'sha256'
        );
        
        // Encrypt the data
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(data), 'utf8'),
            cipher.final()
        ]);
        const authTag = cipher.getAuthTag();
        
        // Return combined encrypted package
        return {
            salt: salt.toString('base64'),
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            data: encrypted.toString('base64')
        };
    }

    decryptBackupData(encryptedPackage) {
        const salt = Buffer.from(encryptedPackage.salt, 'base64');
        const iv = Buffer.from(encryptedPackage.iv, 'base64');
        const authTag = Buffer.from(encryptedPackage.authTag, 'base64');
        const encryptedData = Buffer.from(encryptedPackage.data, 'base64');
        
        // Derive key from master password
        const key = crypto.pbkdf2Sync(
            this.masterPassword,
            salt,
            100000,
            32,
            'sha256'
        );
        
        // Decrypt
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);
        
        return JSON.parse(decrypted.toString('utf8'));
    }

    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    }
}

export default BackupManager;