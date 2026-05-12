# AuraSafe Vault Backup & Restore Guide

## Overview

AuraSafe's Vault Backup & Restore feature allows you to securely export your password vault to an encrypted backup file and import it back when needed. This ensures you never lose access to your passwords, even if you need to reinstall the app, switch devices, or recover from data loss.

## Key Features

- **Encrypted Backups**: All backups are protected with AES-256-GCM encryption
- **Secure Password Protection**: Your backup password is separate from your vault password
- **Flexible Import Options**: Choose to merge with existing data or replace everything
- **Preview Functionality**: View backup contents before importing
- **Cross-Platform Compatibility**: Backups work across different devices and operating systems

## Accessing the Backup Feature

1. Open AuraSafe and unlock your vault
2. Navigate to the **Settings** page
3. Scroll down to find the **"Vault Export/Import"** section
4. Click the **"Open Backup Manager"** button

## Creating a Backup (Export)

### Step-by-Step Instructions

1. **Open the Backup Manager** as described above
2. **Select the "Export" tab**
3. **Enter a backup password**:
   - Choose a strong, unique password (at least 8 characters)
   - This password protects your backup file
   - Remember this password - you'll need it to restore the backup
4. **Confirm the password** by typing it again
5. **Click "Export Vault"**
6. **Choose a save location**:
   - The app will open a file save dialog
   - Default filename: `aurasafe-backup-YYYY-MM-DD.aura`
   - Choose a secure location (external drive, cloud storage, etc.)
7. **Save the file**

### What Gets Backed Up

- All password entries (titles, usernames, passwords, URLs, notes)
- Categories and their organization
- Entry creation and modification dates
- Vault metadata

### Security Notes

- Your backup is encrypted with AES-256-GCM encryption
- The backup password is independent of your vault password
- Store your backup password securely (password manager, secure note)
- Keep backup files in multiple secure locations

## Restoring from a Backup (Import)

### Step-by-Step Instructions

1. **Open the Backup Manager** from Settings
2. **Select the "Import" tab**
3. **Enter the backup password** you used when creating the backup
4. **Choose import mode**:
   - **Merge (recommended)**: Combines backup data with your current vault
   - **Replace all data**: Completely replaces your current vault with the backup
5. **Click "Import Vault"**
6. **Select your backup file**:
   - Navigate to where you saved the `.aura` backup file
   - Select the file and click "Open"
7. **Confirm the import**

### Import Modes Explained

#### Merge Mode
- Adds new entries from the backup
- Updates existing entries if they have the same ID
- Preserves entries that aren't in the backup
- Safe option that won't delete your current data

#### Replace Mode
- Completely replaces all vault data
- Use only if you're sure you want to start fresh
- All current entries will be lost
- Useful for complete vault restoration

## Previewing a Backup

Before importing, you can preview what's in a backup file:

1. **Open the Backup Manager**
2. **Select the "Preview" tab**
3. **Enter the backup password**
4. **Click "Preview Backup"**
5. **Select your backup file**
6. **Review the contents**:
   - Version and export date
   - Number of entries and categories
   - Last backup date

## Best Practices

### Backup Frequency
- **Weekly**: For active users with frequent password changes
- **Monthly**: For regular users
- **Before major changes**: New device, app updates, etc.

### Storage Locations
- **External drives**: USB drives, external hard drives
- **Cloud storage**: Encrypted cloud services (not plain Dropbox/Google Drive)
- **Secure locations**: Safe deposit box, trusted family member
- **Multiple copies**: Keep at least 2-3 copies in different locations

### Password Management
- **Unique passwords**: Don't reuse your vault password as backup password
- **Strong passwords**: Use long, complex backup passwords
- **Secure storage**: Store backup passwords in a separate secure location
- **Regular updates**: Change backup passwords periodically

## Security Considerations

### Encryption Details
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key derivation**: PBKDF2 with 100,000 iterations
- **Salt**: 32-byte random salt per backup
- **Authentication**: GCM provides both confidentiality and integrity

### File Format
- **Extension**: `.aura`
- **Contents**: JSON data encrypted with your password
- **Compatibility**: Works across all platforms (Windows, macOS, Linux)

### Password Requirements
- Minimum 8 characters
- Recommended: 12+ characters with mixed case, numbers, symbols
- Never share your backup password
- Don't store it with the backup file

## Troubleshooting

### Common Issues

#### "Password must be at least 8 characters"
- **Solution**: Choose a longer password for your backup

#### "Invalid vault data" during import
- **Cause**: Corrupted backup file or wrong password
- **Solution**: Verify the backup password and file integrity

#### "Vault is locked" error
- **Cause**: Trying to backup without unlocking the vault first
- **Solution**: Unlock your vault in the main app before accessing backup features

#### Import shows "0 entries imported"
- **Cause**: Empty backup or all entries already exist (in merge mode)
- **Solution**: Check if the backup contains data, or use replace mode

#### Can't find backup file
- **Cause**: File moved, deleted, or wrong location
- **Solution**: Use the file browser to locate your `.aura` file

### Recovery Options

#### If you forget your backup password
- **Unfortunately**: The backup cannot be recovered without the password
- **Prevention**: Store backup passwords securely
- **Alternative**: Create a new backup with a remembered password

#### If backup file is corrupted
- **Check**: Try opening with a text editor (should show encrypted gibberish)
- **Recovery**: Use a previous backup if available
- **Prevention**: Verify backups after creation

#### If import fails partway through
- **Result**: Partial import may occur
- **Recovery**: Export current state, then re-import complete backup
- **Prevention**: Don't modify vault during import

## Advanced Usage

### Command Line Access
Currently, backup operations are only available through the GUI. Future versions may include CLI support.

### Automated Backups
The app doesn't currently support automated backups. Consider:
- Manual weekly backups
- Integration with backup software
- Cloud sync solutions

### Large Vaults
For vaults with thousands of entries:
- Export may take longer
- File size will be larger
- Consider regular cleanup of unused entries

## Support

If you encounter issues not covered in this guide:

1. Check the app's error messages for specific guidance
2. Verify your backup files aren't corrupted
3. Ensure you're using the correct passwords
4. Try restarting the app and attempting the operation again

## Version History

- **v1.0**: Initial implementation with AES-256-GCM encryption
- Basic export/import functionality
- Merge and replace import modes
- Preview functionality

---

**Remember**: Regular backups are your best defense against data loss. Keep multiple copies in secure locations and never forget your backup passwords!