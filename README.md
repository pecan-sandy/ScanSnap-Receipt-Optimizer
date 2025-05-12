# ScanSnap Receipt Organizer

An application that integrates with ScanSnap Manager to help users efficiently organize scanned receipts and invoices into client-specific folders with custom metadata.

## Features

*   **Automatic Scan Detection:** Monitors a designated folder for new scans appearing from ScanSnap Manager or manual placement.
*   **Client Folder Management:**
    *   Select existing client folders for organization.
    *   Add new client destination folders by browsing your system.
    *   Manage (remove) client folders from the application's list via a dedicated modal.
*   **Receipt Metadata Input:**
    *   Input Client Company Name (used for filename, can differ from selected folder name).
    *   Input Vendor Name with **autocomplete suggestions** that are remembered across sessions.
    *   Input Date of receipt (defaults to current date).
    *   Input Total Amount of the receipt.
*   **Persistent Vendor List:**
    *   Vendor names are remembered after successful saves to speed up future entries.
    *   Manage (remove) known vendors via a dedicated modal with search functionality.
*   **Filename Formatting:** Automatically names files using the pattern: `[Client Company Name] [Vendor Name] [Date] [Amount].[ext]`.
*   **File Organization:** Copies the scanned file to the selected client folder with the new formatted name.
*   **Dynamic Preview:** Shows a live preview of the generated filename and the destination folder path.
*   **User-Friendly Interface:**
    *   Modern design with clear layout and interactive feedback.
    *   Toggles for application behavior (Scan Monitoring, Auto-Prompt).
    *   Status messages for success and error feedback, with icons.
    *   Modals for managing client folders and vendors.
    *   "Clear Form" and "Enter-to-Save" functionalities for faster workflow.
*   **Configurable Settings:**
    *   **Scan Monitoring:** Enable or disable the automatic watching of the scan folder.
    *   **Auto-Prompt:** Choose whether the application window appears automatically for new scans or if a system notification is shown instead.
    *   Settings are saved to `~/.scansnap-organizer-settings.json`.
*   **System Tray Integration:**
    *   Provides quick access to toggle Scan Monitoring and Auto-Prompt.
    *   Option to open the main application window.
    *   Option to quit the application.
    *   Application stays running in the background when the main window is closed (can be quit via tray).

## Prerequisites

*   **Node.js:** (Recommended: v16 or higher)
*   **npm:** (Usually comes with Node.js)
*   **ScanSnap Manager Software:** Must be installed and configured.

## Installation

1.  **Clone the repository (if applicable) or download the source files:**
    ```bash
    # If you have a git repository:
    # git clone https://github.com/yourusername/scansnap-receipt-organizer.git
    # cd scansnap-receipt-organizer
    ```
2.  **Navigate to the project directory** in your terminal/command prompt.
3.  **Install dependencies:**
    ```bash
    npm install
    ```

## Configuration - CRITICAL FIRST STEP

Before using the ScanSnap Receipt Organizer application, you **MUST** configure your **ScanSnap Manager software**:

1.  **Open ScanSnap Manager settings** for your scanner profile.
2.  **Set the Scan-to-Folder Location:** Configure ScanSnap Manager to save scanned files directly into the folder that this application monitors.
    *   **Default Monitored Folder:** `YourUserHomeFolder/Documents/ScanSnap/Receipts`
    *   (e.g., `C:/Users/YourName/Documents/ScanSnap/Receipts` on Windows, or `/Users/YourName/Documents/ScanSnap/Receipts` on macOS)
    *   If this folder path does not exist, the ScanSnap Receipt Organizer application will attempt to create it on first launch.
3.  **Set Output File Format:** Configure ScanSnap Manager to save files in **PDF format**. Other formats may work but PDF is recommended and tested.
4.  **(Optional) Adjust Monitored Paths in `main.js`:**
    If you need to change the default monitored folder or the base path for client receipts, you can edit these paths at the top of the `main.js` file within the `CONFIG` object:
    *   `scanWatchFolder`: The folder where ScanSnap Manager saves new scans.
    *   `clientBasePath`: The base directory where *new* client folders were previously created by this app. (Note: With the "Add Existing Client Folder" feature, this path is less critical for defining save locations, as you can pick any folder. It might still be used as a default starting point for browse dialogs if not customized further).

## Running the Application

1.  **Navigate to the project directory** in your terminal/command prompt.
2.  **Start the application:**
    ```bash
    npm start
    ```

## Usage

1.  **Ensure Scan Monitoring is Enabled:**
    *   Check the "Enable Scan Monitoring" toggle in the application's UI or the system tray menu. This must be ON for the app to watch for new scans.

2.  **Scanning a Receipt:**
    *   Scan a receipt or invoice using your ScanSnap scanner (configured as above).

3.  **Processing the Scan:**
    *   **If "Auto-Prompt" is ON:** The ScanSnap Receipt Organizer window will appear with the new scan loaded.
    *   **If "Auto-Prompt" is OFF:** A system notification will appear. Click the notification to open the organizer window with the scan loaded.

4.  **Organizing the Receipt in the App:**
    *   **Select Client Folder:** Choose an existing client folder from the dropdown.
        *   If the folder isn't listed, click **"Add Existing Client Folder"** to browse and select the destination folder on your system. This adds it to the dropdown for future use.
        *   To remove folders from this dropdown list, click **"Manage Folders"**.
    *   **Client Company Name:** This field will auto-fill with the selected folder's name but can be overridden. This name is used for the *filename*.
    *   **Vendor Name:** Start typing the vendor. Suggestions will appear based on previously saved vendors. Use Arrow keys, Tab, or Enter to select, or type a new one.
        *   To remove typos or unwanted vendors from the suggestion list, click **"Manage Vendors"**.
    *   **Date:** Defaults to today but can be changed.
    *   **Total Amount:** Enter the receipt amount.
    *   **Preview:** Review the "File will be saved as" and "In folder" preview.
    *   **Save:**
        *   Click the **"Save Receipt"** button.
        *   Or, if your cursor is in the "Total Amount" field, pressing **Enter** will also save.

5.  The file will be copied to the selected client folder with the formatted name. The original file in the ScanSnap output folder is **not** deleted by default.

## System Tray Menu

Right-click the ScanSnap Receipt Organizer icon in your system tray for these options:

*   **Enable Scan Monitoring:** Toggles whether the app actively watches for new scans.
*   **Auto-Prompt for Receipt Organization:** Toggles between opening the app window automatically or showing a notification for new scans.
*   **Open Receipt Organizer:** Opens the main application window.
*   **Quit:** Closes the application completely.

## Troubleshooting

*   **Application doesn't detect new scans:**
    *   Ensure "Enable Scan Monitoring" is checked in the app's UI or system tray.
    *   Verify ScanSnap Manager is configured to save files to the *exact* folder path that the ScanSnap Receipt Organizer is monitoring (default: `~/Documents/ScanSnap/Receipts`).
    *   Check that ScanSnap Manager is saving files in PDF format.
    *   Make sure no other application is immediately moving or deleting files from the monitored folder before this app can process them.
*   **Client folders don't appear in dropdown / Cannot add client folders:**
    *   Check file system permissions. The application needs permission to read the locations you browse to when adding existing client folders.
*   **File is not saved properly:**
    *   Ensure all required fields in the app are filled out.
    *   Check that the application has write permissions for the selected client destination folder.
    *   Look for any error messages in the app's status bar or in the developer console (Ctrl+Shift+I then click the "Console" tab).
*   **Settings (like client folders, vendors, toggles) are not remembered:**
    *   Ensure the application has permission to write to its settings file: `~/.scansnap-organizer-settings.json`. Deleting this file will cause the app to recreate it with defaults on next launch.
*   **UI toggle for "Auto-Prompt" or "Scan Monitoring" not working or out of sync with tray:**
    *   This usually indicates an IPC (Inter-Process Communication) issue. Ensure you are running the latest version of the code. If developing, check the developer console for errors.

## Building for Distribution (Optional)

To create a packaged application (e.g., an `.exe` for Windows or `.app` for macOS):

1.  **Install build dependencies (if not already done during `npm install`):**
    ```bash
    # electron-builder is likely already in devDependencies
    ```
2.  **Run the build script:**
    ```bash
    npm run build
    ```
    This will generate distributable files in a `dist` folder (or as configured in `package.json`).
3.  **Icon for Packaged App:** To ensure your `assets/icon.png` is used for the final packaged application icon, add the following to the `build` section of your `package.json`:
    ```json
    "build": {
      "icon": "assets/icon.png",
      // ... other build configurations ...
    }
    ```
    For best results across platforms, consider providing platform-specific icon formats (`.icns` for macOS, `.ico` for Windows) and referencing them in the platform-specific build configurations.

---

This application was developed to streamline receipt management. Enjoy!