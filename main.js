// ScanSnap Receipt Organizer
// This application integrates with ScanSnap Manager to organize scanned receipts

const { app, BrowserWindow, ipcMain, dialog, Notification, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const chokidar = require('chokidar'); // For watching directory changes

// Configuration - edit these paths to match your system
const CONFIG = {
    // Path to watch for new scans from ScanSnap Manager
    scanWatchFolder: path.join(os.homedir(), 'Documents', 'ScanSnap', 'Receipts'),
    // Base path for client folders
    clientBasePath: path.join(os.homedir(), 'Documents', 'ClientReceipts'),
    // Path to store application settings
    settingsPath: path.join(os.homedir(), '.scansnap-organizer-settings.json'),
    // Default setting for auto-prompt (can be changed by user)
    autoPromptEnabled: true,
    // Default setting for scan monitoring (can be changed by user)
    monitoringEnabled: true,
    // Maximum number of known vendors to store
    maxKnownVendors: 100 // Optional: to prevent the settings file from growing indefinitely
};

// Store for client folders
let clientFolders = [];
// Store for known vendors (will be loaded from settings)
let knownVendorsSet = new Set();

// Tray icon reference
let tray = null;
// Chokidar watcher instance
let watcher = null;
// Global reference to the main window
let appMainWindow = null;

// Create necessary folders if they don't exist
function ensureFoldersExist() {
    if (!fs.existsSync(CONFIG.scanWatchFolder)) {
        fs.mkdirSync(CONFIG.scanWatchFolder, { recursive: true });
    }

    if (!fs.existsSync(CONFIG.clientBasePath)) {
        fs.mkdirSync(CONFIG.clientBasePath, { recursive: true });
    }
}

// Load settings from disk or create defaults
function loadSettings() {
    try {
        if (fs.existsSync(CONFIG.settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(CONFIG.settingsPath, 'utf8'));
            // Ensure settings.clientFolders is an array of objects with name and path
            if (settings.clientFolders && Array.isArray(settings.clientFolders)) {
                clientFolders = settings.clientFolders.filter(folder => 
                    typeof folder === 'object' && 
                    folder !== null && 
                    typeof folder.name === 'string' && 
                    typeof folder.path === 'string'
                );
            }

            // Load auto-prompt setting if it exists
            if (typeof settings.autoPromptEnabled === 'boolean') {
                CONFIG.autoPromptEnabled = settings.autoPromptEnabled;
            }
            // Load monitoring enabled setting if it exists
            if (typeof settings.monitoringEnabled === 'boolean') {
                CONFIG.monitoringEnabled = settings.monitoringEnabled;
            } else {
                CONFIG.monitoringEnabled = true; // Default to true if not in settings
            }

            // Load known vendors if they exist
            if (settings.knownVendors && Array.isArray(settings.knownVendors)) {
                knownVendorsSet = new Set(settings.knownVendors.slice(0, CONFIG.maxKnownVendors));
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save settings to disk
function saveSettings() {
    try {
        fs.writeFileSync(CONFIG.settingsPath, JSON.stringify({
            clientFolders,
            autoPromptEnabled: CONFIG.autoPromptEnabled,
            monitoringEnabled: CONFIG.monitoringEnabled,
            knownVendors: Array.from(knownVendorsSet) // Save known vendors as an array
        }), 'utf8');
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Start watching the scan folder for new files
function startFileWatcher() {
    if (watcher) { // If watcher already exists, it might be an error or need explicit closing first
        console.log('Watcher already active or not properly closed first. Attempting to close and restart.');
        watcher.close(); 
        watcher = null;
    }
    console.log('Starting file watcher for:', CONFIG.scanWatchFolder);
    try {
        watcher = chokidar.watch(CONFIG.scanWatchFolder, {
            ignored: /(^|[\/\\])\../, // Ignore hidden files
            persistent: true,
            ignoreInitial: true // Don't fire 'add' for existing files on startup
        });

        watcher.on('add', filePath => {
            console.log(`New scan detected by watcher: ${filePath}`);
            // Wait a moment to ensure the file is completely written
            setTimeout(() => {
                processNewScan(filePath);
            }, 1000);
        });

        watcher.on('error', error => {
            console.error(`Watcher error: ${error}`);
            // Consider stopping the watcher or notifying the user if errors persist
        });
        console.log('File watcher started successfully.');
    } catch (error) {
        console.error('Failed to start file watcher:', error);
    }
}

// Stop watching the scan folder
function stopFileWatcher() {
    if (watcher) {
        console.log('Stopping file watcher.');
        watcher.close().then(() => {
            console.log('File watcher closed.');
            watcher = null;
        }).catch(err => {
            console.error('Error closing file watcher:', err);
            watcher = null; // Ensure watcher is reset even on error
        });
    } else {
        console.log('File watcher is not active.');
    }
}

// Initialize the application
function initialize() {
    try {
        ensureFoldersExist();
        loadSettings(); 

        if (CONFIG.monitoringEnabled) {
            startFileWatcher();
        } else {
            console.log('Scan monitoring is disabled by settings.');
        }
    } catch (e) {
        console.error('Initialization Error:', e);
        dialog.showErrorBox('Application Initialization Error', e.stack || e.toString());
        app.quit(); // Exit if critical initialization fails
    }
}

// Process a newly detected scan
function processNewScan(filePath) {
    if (CONFIG.autoPromptEnabled) {
        // Auto-prompt is enabled
        if (appMainWindow && !appMainWindow.isDestroyed()) {
            // If window is already open, just send the file to it
            console.log('Auto-prompt: Window open, sending file.');
            appMainWindow.focus(); // Bring to front
            appMainWindow.webContents.send('scan-file', filePath);
        } else {
            // If no window, or it was closed, create a new one with the file
            console.log('Auto-prompt: Window not open, creating new one.');
            createWindow(filePath);
        }
    } else {
        // Auto-prompt is disabled, create a notification instead
        createNotification(filePath); // createNotification still calls createWindow(filePath) on click
    }
}

// Create a system notification when auto-prompt is disabled
function createNotification(filePath) {
    const isDev = process.env.NODE_ENV === 'development';
    let iconPath = '';
    if (isDev) {
        iconPath = path.join(__dirname, 'assets', 'icon.png');
    } else {
        iconPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon.png');
    }
    console.log('[createNotification] Using icon path:', iconPath);
    // Check if icon exists at this path for packaged app
    if (!isDev && !fs.existsSync(iconPath)) {
        console.error('[createNotification] Packaged icon NOT FOUND at:', iconPath);
        // Potentially use a default Electron icon or no icon if it's critical it exists
    }

    const notification = {
        title: 'New Scan Detected',
        body: 'Click to organize this document as a receipt.',
        icon: iconPath
    };

    const notif = new Notification(notification);

    notif.on('click', () => {
        createWindow(filePath);
    });

    notif.show();
}

// Create the main application window
function createWindow(filePath) {
    // If a window already exists, focus it and send the file path
    if (appMainWindow && !appMainWindow.isDestroyed()) {
        console.log('Main window already open. Focusing and sending file.');
        appMainWindow.focus();
        if (filePath) { // Only send if a filePath is provided
            appMainWindow.webContents.send('scan-file', filePath);
        }
        return; // Don't create a new window
    }

    console.log('Creating new main window.');
    const isDev = process.env.NODE_ENV === 'development';
    let resolvedWindowIconPath = '';
    if (isDev) {
        resolvedWindowIconPath = path.join(__dirname, 'assets', 'icon.png');
    } else {
        resolvedWindowIconPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon.png');
    }
    console.log('[createWindow] Using icon path:', resolvedWindowIconPath);
    if (!isDev && !fs.existsSync(resolvedWindowIconPath)) {
        console.error('[createWindow] Packaged window icon NOT FOUND at:', resolvedWindowIconPath);
    }

    const newWindow = new BrowserWindow({
        width: 700,
        height: 1250,
        icon: resolvedWindowIconPath, 
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'ScanSnap Receipt Organizer'
    });

    newWindow.loadFile('index.html');

    // Assign to global reference
    appMainWindow = newWindow;

    // Once the window is ready, send the file path (if provided for a new window)
    if (filePath) {
        appMainWindow.webContents.on('did-finish-load', () => {
            if (appMainWindow && !appMainWindow.isDestroyed()) { // Check again as load is async
                 appMainWindow.webContents.send('scan-file', filePath);
            }
        });
    }

    // Send initial client folders and statuses to the window when it loads
    appMainWindow.webContents.on('did-finish-load', () => {
        if (appMainWindow && !appMainWindow.isDestroyed()) {
            appMainWindow.webContents.send('client-folders', clientFolders);
            appMainWindow.webContents.send('auto-prompt-status', CONFIG.autoPromptEnabled);
            appMainWindow.webContents.send('monitoring-status-changed', CONFIG.monitoringEnabled);
            appMainWindow.webContents.send('known-vendors-list', Array.from(knownVendorsSet));
        }
    });

    // Handle window closed event
    appMainWindow.on('closed', () => {
        console.log('Main window closed.');
        appMainWindow = null; // Dereference the window object
    });

    // IPC handler to get the list of known vendors
    ipcMain.on('get-known-vendors', (event) => {
        event.reply('known-vendors-list', Array.from(knownVendorsSet));
    });

    // IPC handler to add a new known vendor
    ipcMain.on('add-known-vendor', (event, vendorName) => {
        if (vendorName && typeof vendorName === 'string') {
            const trimmedVendor = vendorName.trim();
            if (trimmedVendor) {
                // Add to set (handles uniqueness)
                knownVendorsSet.add(trimmedVendor);
                
                // Optional: Enforce maxKnownVendors by removing oldest if set is too large
                // This is a simple FIFO, could be more sophisticated (e.g. LRU)
                while (knownVendorsSet.size > CONFIG.maxKnownVendors) {
                    const oldestVendor = knownVendorsSet.values().next().value;
                    knownVendorsSet.delete(oldestVendor);
                }
                saveSettings(); // Save after modification
                // Optionally, send the updated list back, though renderer might handle optimistically
                // event.reply('known-vendors-list', Array.from(knownVendorsSet)); 
            }
        }
    });

    // Handle client folder management
    ipcMain.on('get-client-folders', (event) => {
        // Ensure renderer always gets the latest list, including when get-client-folders is explicitly called
        event.sender.send('client-folders', clientFolders);
    });

    // Handle request to open directory dialog
    ipcMain.on('show-open-directory-dialog', async (event) => {
        const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
            properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const selectedPath = result.filePaths[0];
            const folderName = path.basename(selectedPath);

            // Check if this folder (by path) already exists
            const existingFolder = clientFolders.find(folder => folder.path === selectedPath);
            if (!existingFolder) {
                clientFolders.push({ name: folderName, path: selectedPath });
                saveSettings(); // Save updated client folder list
                // Send the updated list to all windows, or specifically to the requesting one
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('client-folders', clientFolders);
                });
            } else {
                // Optionally, notify the user that the folder is already added
                console.log('Folder already added:', selectedPath);
            }
        }
    });

    // Handle receipt saving
    ipcMain.on('save-receipt', (event, data) => {
        const { clientFolder, clientName, vendorName, date, amount, originalFilePath } = data;

        // Format the filename
        const formattedDate = date.replace(/\//g, '-');
        const newFileName = `${clientName} ${vendorName} ${formattedDate} ${amount}${path.extname(originalFilePath)}`;

        // Determine the destination path
        const destinationPath = path.join(clientFolder, newFileName);

        try {
            // Copy the file to the destination
            fs.copyFileSync(originalFilePath, destinationPath);

            // Optionally, remove the original file
            // fs.unlinkSync(originalFilePath);

            event.reply('save-receipt-result', { success: true, path: destinationPath });
        } catch (error) {
            console.error('Error saving receipt:', error);
            event.reply('save-receipt-result', { success: false, error: error.message });
        }
    });

    // Handle toggle auto-prompt setting
    ipcMain.on('toggle-auto-prompt', (event, enabled) => {
        CONFIG.autoPromptEnabled = enabled;
        saveSettings();
        
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send('auto-prompt-status', CONFIG.autoPromptEnabled);
            }
        });
        // After state changes and UI is notified, update the tray menu to reflect the new state
        if (tray) { // Ensure tray object exists
            createTrayMenu(); // Call a new function that only rebuilds and sets the menu
        }
    });

    // Handle get auto-prompt status
    ipcMain.on('get-auto-prompt-status', (event) => {
        event.reply('auto-prompt-status', CONFIG.autoPromptEnabled);
    });

    // Handle toggle scan monitoring setting from UI
    ipcMain.on('toggle-scan-monitoring', (event, enabled) => {
        CONFIG.monitoringEnabled = enabled;
        saveSettings();

        if (CONFIG.monitoringEnabled) {
            startFileWatcher();
        } else {
            stopFileWatcher();
        }

        // Broadcast status change to all windows
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send('monitoring-status-changed', CONFIG.monitoringEnabled);
            }
        });

        // Update tray menu
        if (tray) {
            createTrayMenu();
        }
    });

    // Handle get monitoring status from UI
    ipcMain.on('get-monitoring-status', (event) => {
        // We can reuse 'monitoring-status-changed' or use a dedicated reply like 'initial-monitoring-status'
        // For simplicity, reusing the existing channel that the UI listens to for updates.
        event.sender.send('monitoring-status-changed', CONFIG.monitoringEnabled);
    });

    // IPC Handler to remove a client folder
    ipcMain.on('remove-client-folder', (event, folderPathToRemove) => {
        if (folderPathToRemove && typeof folderPathToRemove === 'string') {
            const initialLength = clientFolders.length;
            clientFolders = clientFolders.filter(folder => folder.path !== folderPathToRemove);

            if (clientFolders.length < initialLength) { // If a folder was actually removed
                saveSettings();
                // Send the updated list to all windows
                BrowserWindow.getAllWindows().forEach(win => {
                    if (win && !win.isDestroyed() && win.webContents) {
                        win.webContents.send('client-folders', clientFolders);
                    }
                });
                console.log('Removed client folder:', folderPathToRemove, 'New list:', clientFolders);
            } else {
                console.log('Client folder not found for removal:', folderPathToRemove);
            }
        } else {
            console.error('Invalid folderPathToRemove received:', folderPathToRemove);
        }
    });

    // IPC Handler to remove a known vendor
    ipcMain.on('remove-known-vendor', (event, vendorNameToRemove) => {
        if (vendorNameToRemove && typeof vendorNameToRemove === 'string') {
            if (knownVendorsSet.has(vendorNameToRemove)) {
                knownVendorsSet.delete(vendorNameToRemove);
                saveSettings();
                // Broadcast the updated list to all windows
                BrowserWindow.getAllWindows().forEach(win => {
                    if (win && !win.isDestroyed() && win.webContents) {
                        win.webContents.send('known-vendors-list', Array.from(knownVendorsSet));
                    }
                });
                console.log('Removed known vendor:', vendorNameToRemove, 'New set:', knownVendorsSet);
            } else {
                console.log('Known vendor not found for removal:', vendorNameToRemove);
            }
        } else {
            console.error('Invalid vendorNameToRemove received:', vendorNameToRemove);
        }
    });
}

// Create system tray
function createTray() {
    console.log('[createTray] Initializing...');
    console.log('[createTray] __dirname:', __dirname);
    console.log('[createTray] process.resourcesPath:', String(process.resourcesPath)); 
    console.log('[createTray] NODE_ENV:', process.env.NODE_ENV);

    if (!tray) { 
        const isDev = process.env.NODE_ENV === 'development';
        let resolvedTrayIconPath = '';

        if (isDev) {
            resolvedTrayIconPath = path.join(__dirname, 'assets', 'icon.png');
        } else {
            resolvedTrayIconPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'icon.png');
        }
        console.log('[createTray] Attempting to load tray icon from:', resolvedTrayIconPath);
        
        try {
            if (!resolvedTrayIconPath || typeof resolvedTrayIconPath !== 'string' || resolvedTrayIconPath.trim() === '' || !fs.existsSync(resolvedTrayIconPath)) {
                let errorMsg = `Tray icon path is invalid or file does not exist: ${resolvedTrayIconPath}`;
                console.error('[createTray]', errorMsg);
                throw new Error(errorMsg);
            }
            tray = new Tray(resolvedTrayIconPath);
            console.log('[createTray] Tray icon loaded successfully from:', resolvedTrayIconPath);
        } catch (e) {
            console.error('[createTray] Full error creating Tray:', e);
            dialog.showErrorBox('Tray Icon Error', `Failed to load tray icon.\nAttempted path: ${resolvedTrayIconPath}\nError: ${e.message || e.toString()}`);
            return; 
        }

        tray.setToolTip('ScanSnap Receipt Organizer');
        // Double-click on tray icon opens the app
        tray.on('double-click', () => {
            if (appMainWindow && !appMainWindow.isDestroyed()) {
                appMainWindow.focus();
            } else {
                createWindow();
            }
        });
    }
    createTrayMenu(); // Build and set the menu
}

// Function to build and set the tray's context menu
function createTrayMenu() {
    if (!tray) return; // Should not happen if createTray was called first

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Enable Scan Monitoring',
            type: 'checkbox',
            checked: CONFIG.monitoringEnabled,
            click: (menuItem) => {
                CONFIG.monitoringEnabled = menuItem.checked;
                saveSettings();
                if (CONFIG.monitoringEnabled) {
                    startFileWatcher();
                } else {
                    stopFileWatcher();
                }
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('monitoring-status-changed', CONFIG.monitoringEnabled);
                });
                // No need to call createTrayMenu() here as this is part of the menu being rebuilt
            }
        },
        { type: 'separator' },
        {
            label: 'Auto-Prompt for Receipt Organization',
            type: 'checkbox',
            checked: CONFIG.autoPromptEnabled, // This will now reflect the current state
            click: (menuItem) => {
                CONFIG.autoPromptEnabled = menuItem.checked;
                saveSettings();
                BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('auto-prompt-status', CONFIG.autoPromptEnabled);
                });
                // No need to call createTrayMenu() here, as this click itself is from the current menu.
                // However, if another part of the app could change this without UI interaction, it would be needed.
            }
        },
        { type: 'separator' },
        {
            label: 'Open Receipt Organizer',
            click: () => {
                if (appMainWindow && !appMainWindow.isDestroyed()) {
                    appMainWindow.focus();
                } else {
                    createWindow(); 
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);
}

// Application startup
app.whenReady().then(() => {
    try {
        initialize();
        createTray();
        // Don't create a window immediately on startup unless explicitly desired.
        // The app can be started via tray icon or by opening a file (if that feature is added).
        // Or, if a window should always open, call createWindow() here.
        // For now, relying on tray or future file association / dock click.
    } catch (e) {
        console.error('Application Startup Error:', e);
        dialog.showErrorBox('Application Startup Error', e.stack || e.toString());
        app.quit();
    }

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (appMainWindow === null || appMainWindow.isDestroyed()) {
            createWindow(); // Create new window, no specific file path initially
        } else {
            appMainWindow.focus();
        }
    });
});

// Keep the app running in the background even when all windows are closed
app.on('window-all-closed', function () {
    // On macOS it is common for applications to stay open in the background
    // For this app, we want to keep it running on all platforms
    // So we don't quit the app here
});