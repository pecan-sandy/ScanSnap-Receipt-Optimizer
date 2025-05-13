// This script will be enhanced by the preload.js with IPC capabilities

let sessionKnownVendors = new Set();
let activeSuggestionIndex = -1; // To track the highlighted suggestion index
let currentDisplayedSuggestions = []; // To store the string values of current suggestions

// DOM Elements
const clientFolderSelect = document.getElementById('client-folder');
const clientNameInput = document.getElementById('client-name');
const vendorNameInput = document.getElementById('vendor-name');
const dateInput = document.getElementById('date');
const amountInput = document.getElementById('amount');
const addExistingClientFolderBtn = document.getElementById('add-existing-client-folder-btn');
const saveBtn = document.getElementById('save-btn');
const filenamePreview = document.getElementById('filename-preview');
const folderPreview = document.getElementById('folder-preview');
const statusMessage = document.getElementById('status-message');
const autoPromptToggle = document.getElementById('auto-prompt-toggle');
const monitoringToggle = document.getElementById('monitoring-toggle'); 
const vendorSuggestionsDiv = document.getElementById('vendor-suggestions');
const vendorNameGhostInput = document.getElementById('vendor-name-ghost');
const clearFormBtn = document.getElementById('clear-form-btn'); // New button
const clientFolderEmptyState = document.getElementById('client-folder-empty-state'); // New empty state div
const manageFoldersModal = document.getElementById('manage-folders-modal');
const closeManageFoldersModalBtn = document.getElementById('close-manage-folders-modal');
const manageClientFoldersBtn = document.getElementById('manage-client-folders-btn');
const manageableClientFoldersList = document.getElementById('manageable-client-folders-list');
const manageVendorsModal = document.getElementById('manage-vendors-modal'); // New modal
const closeManageVendorsModalBtn = document.getElementById('close-manage-vendors-modal'); // New close button
const manageVendorsBtn = document.getElementById('manage-vendors-btn'); // New manage button
const manageableVendorsList = document.getElementById('manageable-vendors-list'); // New list UL
const searchVendorsInput = document.getElementById('search-vendors-input'); // New search input

// Set today's date as default
const today = new Date();
dateInput.value = today.toISOString().split('T')[0];

// Store the path of the current scan
let currentScanPath = '';

// Initialize client folders & known vendors & statuses
window.electron.send('get-client-folders');
window.electron.send('get-known-vendors');
window.electron.send('get-auto-prompt-status');
window.electron.send('get-monitoring-status'); 

// Receive client folders
window.electron.receive('client-folders', (folders) => { 
    while (clientFolderSelect.options.length > 1) { clientFolderSelect.remove(1); }
    manageableClientFoldersList.innerHTML = ''; // Clear modal list too

    folders.forEach(folder => {
        // Populate main dropdown
        const option = document.createElement('option');
        option.value = folder.path;
        option.textContent = folder.name;
        clientFolderSelect.appendChild(option);

        // Populate modal list
        const listItem = document.createElement('li');
        const folderNameSpan = document.createElement('span');
        folderNameSpan.textContent = `${folder.name} (${folder.path})`; // Show name and path for clarity
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.classList.add('remove-folder-btn');
        removeBtn.dataset.path = folder.path; // Store path to identify for removal
        removeBtn.addEventListener('click', () => {
            // IPC call to remove folder will be added in Phase 2
            console.log('Attempt to remove folder:', folder.path);
            window.electron.send('remove-client-folder', folder.path);
        });
        listItem.appendChild(folderNameSpan);
        listItem.appendChild(removeBtn);
        manageableClientFoldersList.appendChild(listItem);
    });
    
    if (folders.length === 0) {
        clientFolderEmptyState.style.display = 'block';
        // Optionally, display a message in the modal too if it's open
        if(manageFoldersModal.style.display === 'block') {
            manageableClientFoldersList.innerHTML = '<li>No client folders configured.</li>';
        }
    } else {
        clientFolderEmptyState.style.display = 'none';
    }
});

// Show/Hide Manage Folders Modal
manageClientFoldersBtn.addEventListener('click', () => {
    manageFoldersModal.classList.add('is-visible');
    window.electron.send('get-client-folders'); 
});

closeManageFoldersModalBtn.addEventListener('click', () => {
    manageFoldersModal.classList.remove('is-visible');
});

// Close modal if user clicks outside of the modal content
window.addEventListener('click', (event) => {
    if (event.target === manageFoldersModal) {
        manageFoldersModal.classList.remove('is-visible');
    }
    if (event.target === manageVendorsModal) {
        manageVendorsModal.classList.remove('is-visible');
    }
});

// Receive known vendors list
window.electron.receive('known-vendors-list', (vendorsArray) => { 
    console.log('Renderer received known-vendors-list:', vendorsArray);
    if (Array.isArray(vendorsArray)) {
        sessionKnownVendors = new Set(vendorsArray);
        populateManageVendorsList();
    } else {
        console.error('known-vendors-list did not receive an array:', vendorsArray);
        sessionKnownVendors = new Set();
        manageableVendorsList.innerHTML = '<li>Error loading vendors.</li>';
    }
});

// Function to populate/filter the Manage Vendors modal list
function populateManageVendorsList() {
    const searchTerm = searchVendorsInput.value.toLowerCase();
    manageableVendorsList.innerHTML = '';

    const vendorsToDisplay = Array.from(sessionKnownVendors).filter(vendorName => 
        vendorName.toLowerCase().includes(searchTerm)
    );

    if (vendorsToDisplay.length === 0) {
        manageableVendorsList.innerHTML = `<li>No vendors found ${searchTerm ? 'matching \"' + searchTerm + '\"' : 'yet'}.</li>`;
        return;
    }

    const sortedVendors = vendorsToDisplay.sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    sortedVendors.forEach(vendorName => {
        const listItem = document.createElement('li');
        const vendorNameSpan = document.createElement('span');
        vendorNameSpan.textContent = vendorName;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.classList.add('remove-vendor-btn'); 
        removeBtn.dataset.vendor = vendorName; 
        removeBtn.addEventListener('click', () => {
            console.log('Attempt to remove vendor:', vendorName);
            window.electron.send('remove-known-vendor', vendorName);
        });
        listItem.appendChild(vendorNameSpan);
        listItem.appendChild(removeBtn);
        manageableVendorsList.appendChild(listItem);
    });
}

// Add event listener for the search input
searchVendorsInput.addEventListener('input', populateManageVendorsList);

// Show/Hide Manage Vendors Modal
manageVendorsBtn.addEventListener('click', () => {
    manageVendorsModal.classList.add('is-visible');
    searchVendorsInput.value = ''; 
    window.electron.send('get-known-vendors'); 
});

closeManageVendorsModalBtn.addEventListener('click', () => {
    manageVendorsModal.classList.remove('is-visible');
});

// Handle client folder selection
clientFolderSelect.addEventListener('change', () => {
    // if (clientFolderSelect.value) { 
    //     clientNameInput.value = clientFolderSelect.options[clientFolderSelect.selectedIndex].text; 
    // } else {
    //     clientNameInput.value = ''; 
    // }
    // The user will now manually enter the Client Company Name for the filename.
    // The dropdown selection only determines the save path.
    updatePreview(); // Still update preview as the folder path changes
});

// Handle "Add Existing Client Folder" button
addExistingClientFolderBtn.addEventListener('click', () => {
    window.electron.send('show-open-directory-dialog');
});

// Handle input changes for preview 
[clientNameInput, vendorNameInput, dateInput, amountInput].forEach(input => {
    input.addEventListener('input', updatePreview);
});

// Allow Enter key in Amount field to trigger Save Receipt
amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        // Check if saveBtn is already disabled to prevent multiple triggers
        if (saveBtn.disabled) return;

        // Programmatically click the Save Receipt button
        // The saveBtn click listener will handle disabling itself and actual save logic
        saveBtn.click(); 
        
        // Optimistically clear and set focus for faster perceived response
        // Note: The actual clearing after successful save is still in 'save-receipt-result'
        vendorNameInput.value = ''; // Optimistic clear
        amountInput.value = '';   // Optimistic clear
        vendorNameGhostInput.value = '';
        vendorNameInput.focus(); // Immediate focus shift
    }
});

// Autocomplete for Vendor Name
vendorNameInput.addEventListener('input', () => {
    const inputText = vendorNameInput.value;
    const lowerInputText = inputText.toLowerCase(); 
    
    console.log('[VendorInput] Autocomplete typing. Current sessionKnownVendors:', Array.from(sessionKnownVendors)); // DIAGNOSTIC LOG

    vendorNameGhostInput.value = ''; 

    if (inputText.length === 0) { 
        clearAndHideSuggestions();
        return;
    }

    const matchedSuggestions = Array.from(sessionKnownVendors).filter(vendor =>
        vendor.toLowerCase().startsWith(lowerInputText)
    );
    
    matchedSuggestions.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    currentDisplayedSuggestions = matchedSuggestions;
    if (currentDisplayedSuggestions.length > 0) {
        activeSuggestionIndex = 0;
        const topSuggestion = currentDisplayedSuggestions[0];
        if (topSuggestion.toLowerCase().startsWith(lowerInputText) && topSuggestion.length > inputText.length) {
            vendorNameGhostInput.value = inputText + topSuggestion.substring(inputText.length);
        } else if (topSuggestion.toLowerCase() === lowerInputText) {
             vendorNameGhostInput.value = topSuggestion; 
        } else {
            vendorNameGhostInput.value = '';
        }
    } else {
        activeSuggestionIndex = -1;
        vendorNameGhostInput.value = '';
    }
    updateSuggestionHighlight();
});

function clearAndHideSuggestions() {
    vendorSuggestionsDiv.innerHTML = '';
    vendorSuggestionsDiv.style.display = 'none';
    activeSuggestionIndex = -1;
    currentDisplayedSuggestions = [];
    vendorNameGhostInput.value = ''; 
}

function updateSuggestionHighlight() {
    vendorSuggestionsDiv.innerHTML = ''; 

    if (currentDisplayedSuggestions.length > 0) {
        currentDisplayedSuggestions.forEach((suggestion, index) => {
            const suggestionEl = document.createElement('div');
            suggestionEl.textContent = suggestion;
            suggestionEl.addEventListener('click', () => {
                vendorNameInput.value = suggestion;
                clearAndHideSuggestions();
                updatePreview();
            });
            suggestionEl.addEventListener('mouseover', () => {
                activeSuggestionIndex = index;
                _updateClassesForHighlight();
            });
            if (index === activeSuggestionIndex) {
                suggestionEl.classList.add('suggestion-active');
            }
            vendorSuggestionsDiv.appendChild(suggestionEl);
        });
        vendorSuggestionsDiv.style.display = 'block';
    } else {
        vendorSuggestionsDiv.style.display = 'none';
    }
}

function _updateClassesForHighlight(){
    const suggestionElements = vendorSuggestionsDiv.querySelectorAll('div');
    suggestionElements.forEach((el, index) => {
        if (index === activeSuggestionIndex) {
            el.classList.add('suggestion-active');
        } else {
            el.classList.remove('suggestion-active');
        }
    });
}

vendorNameInput.addEventListener('keydown', (e) => {
    if (vendorSuggestionsDiv.style.display !== 'block' || currentDisplayedSuggestions.length === 0) {
        if (e.key === 'Tab' && vendorNameGhostInput.value && vendorNameGhostInput.value !== vendorNameInput.value) {
            e.preventDefault();
            vendorNameInput.value = vendorNameGhostInput.value; 
            clearAndHideSuggestions(); 
            updatePreview();
            return;
        }
        if(e.key === 'Tab') return;
        return;
    }

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % currentDisplayedSuggestions.length;
            _updateClassesForHighlight();
            if (activeSuggestionIndex === 0 && currentDisplayedSuggestions.length > 0) {
                 const topSuggestion = currentDisplayedSuggestions[0];
                 if (topSuggestion.toLowerCase().startsWith(vendorNameInput.value.toLowerCase()) && topSuggestion.length > vendorNameInput.value.length) {
                     vendorNameGhostInput.value = vendorNameInput.value + topSuggestion.substring(vendorNameInput.value.length);
                 } else if (topSuggestion.toLowerCase() === vendorNameInput.value.toLowerCase()) {
                     vendorNameGhostInput.value = topSuggestion;
                 } else {
                     vendorNameGhostInput.value = '';
                 }
            } else {
                vendorNameGhostInput.value = ''; 
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex - 1 + currentDisplayedSuggestions.length) % currentDisplayedSuggestions.length;
            _updateClassesForHighlight();
             if (activeSuggestionIndex === 0 && currentDisplayedSuggestions.length > 0) {
                 const topSuggestion = currentDisplayedSuggestions[0];
                 if (topSuggestion.toLowerCase().startsWith(vendorNameInput.value.toLowerCase()) && topSuggestion.length > vendorNameInput.value.length) {
                     vendorNameGhostInput.value = vendorNameInput.value + topSuggestion.substring(vendorNameInput.value.length);
                 } else if (topSuggestion.toLowerCase() === vendorNameInput.value.toLowerCase()) {
                     vendorNameGhostInput.value = topSuggestion;
                 } else {
                     vendorNameGhostInput.value = '';
                 }
            } else {
                vendorNameGhostInput.value = ''; 
            }
            break;
        case 'Enter':
            if (activeSuggestionIndex > -1 && activeSuggestionIndex < currentDisplayedSuggestions.length) {
                e.preventDefault();
                vendorNameInput.value = currentDisplayedSuggestions[activeSuggestionIndex];
                clearAndHideSuggestions(); 
                updatePreview();
            }
            break;
        case 'Tab':
            if (activeSuggestionIndex > -1 && activeSuggestionIndex < currentDisplayedSuggestions.length) {
                e.preventDefault();
                vendorNameInput.value = currentDisplayedSuggestions[activeSuggestionIndex];
                clearAndHideSuggestions(); 
                updatePreview();
            } else if (vendorNameGhostInput.value && vendorNameGhostInput.value !== vendorNameInput.value) {
                e.preventDefault();
                vendorNameInput.value = vendorNameGhostInput.value;
                clearAndHideSuggestions();
                updatePreview();
            } else {
                clearAndHideSuggestions();
            }
            break;
        case 'Escape':
            clearAndHideSuggestions(); 
            break;
    }
});

document.addEventListener('click', (event) => {
    if (!vendorNameInput.contains(event.target) && !vendorSuggestionsDiv.contains(event.target)) {
        vendorSuggestionsDiv.style.display = 'none';
        if (!vendorNameInput.contains(event.target)) {
             vendorNameGhostInput.value = '';
        }
    }
});

function updatePreview() {
    const client = clientNameInput.value || '--';
    const vendor = vendorNameInput.value || '--';
    const date = dateInput.value ? formatDate(dateInput.value) : '--';
    const amount = amountInput.value || '--';

    filenamePreview.textContent = `${client} ${vendor} ${date} ${amount}.pdf`;
    folderPreview.textContent = clientFolderSelect.value || '--';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString();
    const day = date.getDate().toString();
    const year = date.getFullYear().toString().substr(-2);
    return `${month}-${day}-${year}`;
}

// Handle save button
saveBtn.addEventListener('click', () => {
    if (saveBtn.disabled) return; // Prevent double-click if already processing

    // Validate inputs
    if (!clientFolderSelect.value) {
        showStatus('Please select a client folder', false); return;
    }
    if (!clientNameInput.value) {
        showStatus('Please enter a client name', false); return;
    }
    if (!vendorNameInput.value) {
        showStatus('Please enter a vendor name', false); return;
    }
    if (!dateInput.value) {
        showStatus('Please select a date', false); return;
    }
    if (!amountInput.value) {
        showStatus('Please enter an amount', false); return;
    }
    if (!currentScanPath) {
        showStatus('No scanned file to process', false); return;
    }

    // Disable button to prevent multiple submissions
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...'; 

    const vendorToSave = vendorNameInput.value.trim(); // Get vendor name BEFORE sending

    window.electron.send('save-receipt', {
        clientFolder: clientFolderSelect.value,
        clientName: clientNameInput.value,
        vendorName: vendorToSave, // Use the captured vendor name
        date: formatDate(dateInput.value),
        amount: amountInput.value,
        originalFilePath: currentScanPath,
        // alsoSendVendorForKnowing: vendorToSave // Send it explicitly for main process
    });
});

window.electron.receive('save-receipt-result', (result) => { 
    // Re-enable button regardless of success or failure
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-save"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save Receipt';

    if (result.success) {
        showStatus(`Receipt saved successfully to ${result.path}`, true);
        // const vendor = vendorNameInput.value.trim(); // OLD: Might be empty due to optimistic clear
        // Main process will handle adding vendor from the 'save-receipt' payload if successful
        // Optimistic add to local set for UI is still good if the vendor was successfully sent.
        // We need the vendor name that was actually part of the successful save.
        // It was sent via result.vendorNameUsedInSave from main.js now.

        if (result.vendorNameUsedInSave) { // Check if main process sent it back
            sessionKnownVendors.add(result.vendorNameUsedInSave);
            console.log('Optimistically added to sessionKnownVendors (from main process confirmation):', result.vendorNameUsedInSave, 'Current set:', Array.from(sessionKnownVendors));
        }

        // The actual clearing of vendor/amount for the *next* receipt happens after a delay
        // OR if a new scan comes in, or by the optimistic clear.
        // The optimistic clear from Enter key handles the immediate visual feedback.
        // The setTimeout here ensures fields are cleared if save was from a button click.
        setTimeout(() => {
            // Only clear if not already cleared by optimistic clear (e.g. if user clicked save button)
            // However, optimistic clear already did this for Enter key.
            // To avoid confusion, let's make the timeout clear only if values are still present.
            if (vendorNameInput.value !== '' || amountInput.value !== '') {
                 vendorNameInput.value = '';
                 amountInput.value = '';
            }
            // If focus was not already set to vendorNameInput (e.g. by Enter key press), set it now.
            if (document.activeElement !== vendorNameInput) {
                vendorNameInput.focus();
            }
        }, 2000); // This delay is quite long, consider reducing or removing if optimistic clear is sufficient
    } else {
        showStatus(`Error saving receipt: ${result.error}`, false);
        // If save failed, and fields were optimistically cleared, user might want to re-enter.
        // However, for simplicity, we won't try to restore them here.
        // Focus might still go to vendor name due to optimistic logic.
    }
});

window.electron.receive('scan-file', (filePath) => { 
    currentScanPath = filePath;
    const filenameForDisplay = filePath.substring(filePath.lastIndexOf('\\') + 1).substring(filePath.lastIndexOf('/') + 1);
    showStatus(`New scan loaded: ${filenameForDisplay}`, true);
    
    vendorNameInput.value = '';
    amountInput.value = '';
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
    updatePreview();
});

function showStatus(message, isSuccess) {
    const statusIconSpan = statusMessage.querySelector('.status-icon');
    const statusTextSpan = statusMessage.querySelector('.status-text');

    if (!statusIconSpan || !statusTextSpan) { // Should not happen if HTML is correct
        statusMessage.textContent = message; // Fallback
    } else {
        statusTextSpan.textContent = message;
        if (isSuccess) {
            statusIconSpan.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        } else {
            statusIconSpan.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        }
    }

    statusMessage.className = 'status-message ' + (isSuccess ? 'success' : 'error');
    statusMessage.style.display = 'block';
    setTimeout(() => {
        statusMessage.style.display = 'none';
    }, 5000);
}

autoPromptToggle.addEventListener('change', () => {
    console.log('[UI Toggle Event] Change detected. Checked state:', autoPromptToggle.checked);
    window.electron.send('toggle-auto-prompt', autoPromptToggle.checked);
});

window.electron.send('get-auto-prompt-status');

window.electron.receive('auto-prompt-status', (newStatus) => { 
    console.log('Renderer received auto-prompt-status:', newStatus, '(Event was previously logged here)');
    autoPromptToggle.checked = newStatus;
});

monitoringToggle.addEventListener('change', () => {
    console.log('[UI Monitoring Toggle Event] Change detected. Checked state:', monitoringToggle.checked);
    window.electron.send('toggle-scan-monitoring', monitoringToggle.checked);
});

window.electron.receive('monitoring-status-changed', (newStatus) => { 
    console.log('Renderer received monitoring-status-changed:', newStatus);
    monitoringToggle.checked = newStatus;
});

// Handle Clear Form button
clearFormBtn.addEventListener('click', () => {
    clientNameInput.value = '';
    vendorNameInput.value = '';
    amountInput.value = '';
    dateInput.value = today.toISOString().split('T')[0]; // Reset date to today
    currentScanPath = ''; // Clear current scan path
    vendorNameGhostInput.value = ''; // Clear ghost text
    clearAndHideSuggestions(); // Clear vendor suggestions
    updatePreview();
    // clientFolderSelect.selectedIndex = 0; // Optionally reset client folder selection
    showStatus('Form cleared', true);
});

updatePreview(); 