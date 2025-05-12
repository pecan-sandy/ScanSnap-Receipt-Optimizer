// Preload script for ScanSnap Receipt Organizer
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron',
    {
        send: (channel, data) => {
            // Allow only specific channels for sending
            const validSendChannels = [
                'get-client-folders',
                'save-receipt',
                'toggle-auto-prompt',
                'get-auto-prompt-status',
                'show-open-directory-dialog',
                'get-known-vendors',
                'add-known-vendor',
                'toggle-scan-monitoring',
                'get-monitoring-status',
                'remove-client-folder',
                'remove-known-vendor'
            ];
            if (validSendChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            // Allow only specific channels for receiving
            const validReceiveChannels = [
                'client-folders',
                'save-receipt-result',
                'scan-file',
                'auto-prompt-status',
                'monitoring-status-changed',
                'known-vendors-list'
            ];
            if (validReceiveChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        },
        removeAllListeners: (channel) => {
            ipcRenderer.removeAllListeners(channel);
        }
    }
);