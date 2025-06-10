// Firebase global variables are made available by the Canvas environment
// These are essential for Firebase initialization and authentication
// If __firebase_config is not available (e.g., running outside Canvas),
// use the user's provided config. PLEASE ENSURE IT'S FULLY CONFIGURED.
let firebaseApp, db, auth, analytics, userId = null; // Changed to let
let appId = null; // Changed to let, assigned in initializeFirebase
let firebaseConfig = {}; // Changed to let, assigned in initializeFirebase
let initialAuthToken = null; // Changed to let, assigned in initializeFirebase

let tripData = []; // This will now store data fetched from Realtime Database
let listingData = []; // This will now store data fetched from Realtime Database
let isAuthReady = false; // Flag to indicate Firebase Auth is initialized

// Constants
const EDIT_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds for editing

// Get references to DOM elements
const homePage = document.getElementById('homePage');
const tripPage = document.getElementById('tripPage');
const listingPage = document.getElementById('listingPage');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const userIdDisplay = document.getElementById('userIdDisplay'); // To show the authenticated user ID

const tripBtn = document.getElementById('tripBtn');
const listingBtn = document.getElementById('listingBtn');

const addTripBtn = document.getElementById('addTripBtn');
// Removed downloadTripPdfBtn as it's no longer used
const totalExpenseDisplay = document.getElementById('totalExpenseDisplay');
const tripModal = document.getElementById('tripModal');
const tripForm = document.getElementById('tripForm');
const cancelTripBtn = document.getElementById('cancelTripBtn');
const tripTableBody = document.getElementById('tripTable').querySelector('tbody');

const addListingBtn = document.getElementById('addListingBtn');
const listingModal = document.getElementById('listingModal');
const listingForm = document.getElementById('listingForm');
const cancelListingBtn = document.getElementById('cancelListingBtn');
const listingTableBody = document.getElementById('listingTable').querySelector('tbody');

// Set current year in footer
document.getElementById('currentYear').textContent = new Date().getFullYear();

/**
 * Initializes Firebase, authenticates the user, and sets up Realtime Database listeners.
 */
async function initializeFirebase() {
    console.log("Attempting to initialize Firebase...");
    try {
        // Assign Canvas-provided variables inside this function for robust access
        appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
            apiKey: "YOUR_API_KEY", // <--- REPLACE with your Firebase API Key
            apiKey: "AIzaSyDYdD9tyrDmiFi1fYKd6lvLiKICKLWVmnY",
            authDomain: "ad-associates-official.firebaseapp.com",
            databaseURL: "https://ad-associates-official-default-rtdb.firebaseio.com",
            projectId: "ad-associates-official",
            storageBucket: "ad-associates-official.firebasestorage.app",
            messagingSenderId: "407411380354",
            appId: "1:407411380354:web:f72766d2d3d5e14fdca49b",
            measurementId: "G-T822NHJHWP"// <--- REPLACE with your Firebase Measurement ID (optional)
        };
        initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        console.log("App ID being used:", appId); // Log the resolved appId
        console.log("Firebase Config being used:", firebaseConfig); // Log the resolved firebaseConfig

        // Access Firebase modules from the global window object
        firebaseApp = window.firebase.initializeApp(firebaseConfig);
        auth = window.firebase.getAuth(firebaseApp);
        db = window.firebase.getDatabase(firebaseApp); // Get Realtime Database instance
        console.log("Firebase App, Auth, and Database instances obtained.");

        // Initialize Analytics if measurementId is provided in config and not a placeholder
        if (firebaseConfig.measurementId && firebaseConfig.measurementId !== "YOUR_MEASUREMENT_ID") {
            try {
                analytics = window.firebase.getAnalytics(firebaseApp);
                console.log('Firebase Analytics initialized successfully.');
            } catch (e) {
                console.warn('Failed to initialize Firebase Analytics:', e.message);
            }
        } else {
            console.log('Firebase Analytics not configured or placeholder used.');
        }

        // Listen for auth state changes
        window.firebase.onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in
                userId = user.uid;
                userIdDisplay.textContent = `User ID: ${userId}`;
                isAuthReady = true;
                console.log(`Firebase authenticated. User ID: ${userId}`);

                // Start listening to data once authenticated
                setupDatabaseListeners(appId); // Pass appId
            } else {
                // User is signed out. Attempt anonymous sign-in or use custom token.
                console.log('No user signed in. Attempting authentication...');
                userIdDisplay.textContent = 'User ID: Authenticating...';
                try {
                    if (initialAuthToken) {
                        await window.firebase.signInWithCustomToken(auth, initialAuthToken);
                        console.log('Successfully signed in with custom token.');
                    } else {
                        await window.firebase.signInAnonymously(auth);
                        console.log('Successfully signed in anonymously.');
                    }
                } catch (error) {
                    console.error('Firebase authentication failed:', error.message);
                    userIdDisplay.textContent = 'User ID: Authentication Failed!';
                }
            }
        });
    } catch (error) {
        console.error("Error initializing Firebase:", error.message);
        userIdDisplay.textContent = 'User ID: Initialization Error!';
    }
}

/**
 * Sets up real-time listeners for Trip and Listing data from Realtime Database.
 * This function should only be called once authentication is ready (`isAuthReady` is true).
 * @param {string} currentAppId - The application ID.
 */
function setupDatabaseListeners(currentAppId) {
    if (!isAuthReady || !db || !userId) {
        console.warn("Realtime Database listeners cannot be set up yet. Authentication not ready or DB/User ID missing.");
        return;
    }
    console.log("Setting up Realtime Database listeners...");

    // Realtime Database References for private user data
    // Path: artifacts/{currentAppId}/users/{userId}/trips
    const tripsRef = window.firebase.ref(db, `artifacts/${currentAppId}/users/${userId}/trips`);
    // Path: artifacts/{currentAppId}/users/{userId}/listings
    const listingsRef = window.firebase.ref(db, `artifacts/${currentAppId}/users/${userId}/listings`);

    // Listen for real-time updates on Trip data
    window.firebase.onValue(tripsRef, (snapshot) => {
        console.log("Trip data snapshot received.");
        tripData = [];
        let serialCounter = 1; // For display purposes, reset for each full snapshot
        snapshot.forEach((childSnapshot) => {
            const key = childSnapshot.key;
            const data = childSnapshot.val();
            tripData.push({
                id: key, // Use Realtime Database push key as unique ID
                serialNo: serialCounter++, // Assign display serial number
                expense: data.expense,
                startingKM: data.startingKM,
                endKM: data.endKM,
                name: data.name,
                remarks: data.remarks || '', // Ensure remarks is always a string
                submissionTime: data.submissionTime // Stored as a number (timestamp in ms)
            });
        });
        // Sort data by submission time to maintain consistent serial numbers on display
        tripData.sort((a, b) => a.submissionTime - b.submissionTime);
        renderTripTable(); // No need to pass appId here, as it's a global now or accessed via closure
    }, (error) => {
        console.error("Error fetching trip data from Realtime Database:", error.message);
    });

    // Listen for real-time updates on Listing data
    window.firebase.onValue(listingsRef, (snapshot) => {
        console.log("Listing data snapshot received.");
        listingData = [];
        let serialCounter = 1; // For display purposes, reset for each full snapshot
        snapshot.forEach((childSnapshot) => {
            const key = childSnapshot.key;
            const data = childSnapshot.val();
            listingData.push({
                id: key, // Use Realtime Database push key as unique ID
                serialNo: serialCounter++, // Assign display serial number
                itemName: data.itemName,
                quantity: data.quantity
            });
        });
        // Sort listings by item name for consistent display
        listingData.sort((a, b) => a.itemName.localeCompare(b.itemName));
        renderListingTable(); // No need to pass appId here
    }, (error) => {
        console.error("Error fetching listing data from Realtime Database:", error.message);
    });
}

/**
 * Function to navigate between pages.
 * Hides all pages and then shows the specified page.
 * Also controls the visibility of the "Back to Home" button.
 * @param {string} pageId - The ID of the page to show ('homePage', 'tripPage', 'listingPage').
 */
function navigateTo(pageId) {
    homePage.classList.add('hidden');
    tripPage.classList.add('hidden');
    listingPage.classList.add('hidden');

    document.getElementById(pageId).classList.remove('hidden');

    if (pageId === 'homePage') {
        backToHomeBtn.classList.add('hidden');
    } else {
        backToHomeBtn.classList.remove('hidden');
    }
}

/**
 * Updates a specific field of a trip entry in Realtime Database.
 * @param {string} docId - The Realtime Database key (ID) of the trip entry to update.
 * @param {string} field - The field name ('expense', 'startingKM', 'endKM', 'name', 'remarks').
 * @param {any} value - The new value for the field.
 */
async function updateTripEntry(docId, field, value) {
    if (!db || !userId || !appId) { // Check appId
        console.error("Realtime Database not initialized, user not authenticated, or appId is missing. Cannot update trip entry.");
        return;
    }
    const tripEntryRef = window.firebase.ref(db, `artifacts/${appId}/users/${userId}/trips/${docId}`);
    try {
        await window.firebase.update(tripEntryRef, { [field]: value });
        console.log(`Trip entry ${docId} field '${field}' updated to '${value}' successfully.`);
    } catch (error) {
        console.error(`Error updating trip entry ${docId} field '${field}':`, error.message);
    }
}

/**
 * Calculates and updates the total expense displayed.
 */
function updateTotalExpenseDisplay() {
    const total = tripData.reduce((sum, entry) => sum + (entry.expense || 0), 0);
    totalExpenseDisplay.textContent = total.toFixed(2); // Format to 2 decimal places
}

/**
 * Renders the trip expense data into the trip table.
 * Fields are editable, with a 12-hour editing window.
 */
function renderTripTable() {
    tripTableBody.innerHTML = ''; // Clear existing rows

    if (tripData.length === 0) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = `<td colspan="7" class="px-6 py-4 whitespace-nowrap text-center text-gray-500">
            No trip expenses added yet.
        </td>`;
        tripTableBody.appendChild(noDataRow);
    } else {
        tripData.forEach(entry => {
            const currentTime = Date.now();
            // submissionTime is already a number (timestamp in ms) from RTDB
            const editableUntil = entry.submissionTime + EDIT_WINDOW_MS;
            const isEditable = currentTime < editableUntil;

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${entry.serialNo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    <input type="number" value="${entry.expense}" min="0" step="1"
                        class="editable-input ${isEditable ? '' : 'disabled'}"
                        data-doc-id="${entry.id}" data-field="expense" ${isEditable ? '' : 'disabled'} />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    <input type="number" value="${entry.startingKM}" min="0" step="1"
                        class="editable-input ${isEditable ? '' : 'disabled'}"
                        data-doc-id="${entry.id}" data-field="startingKM" ${isEditable ? '' : 'disabled'} />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    <input type="number" value="${entry.endKM}" min="0" step="1"
                        class="editable-input ${isEditable ? '' : 'disabled'}"
                        data-doc-id="${entry.id}" data-field="endKM" ${isEditable ? '' : 'disabled'} />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    <input type="text" value="${entry.name}"
                        class="editable-input ${isEditable ? '' : 'disabled'}"
                        data-doc-id="${entry.id}" data-field="name" ${isEditable ? '' : 'disabled'} />
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    <textarea
                        class="editable-input resize-y ${isEditable ? '' : 'disabled'}"
                        data-doc-id="${entry.id}" data-field="remarks" ${isEditable ? '' : 'disabled'}
                        rows="1">${entry.remarks || ''}</textarea>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                    ${isEditable ? '<span class="text-green-600 font-semibold">Editable</span>' : '<span class="text-red-600 font-semibold">Locked</span>'}
                </td>
            `;
            tripTableBody.appendChild(row);

            if (isEditable) {
                const inputs = row.querySelectorAll('.editable-input');
                inputs.forEach(input => {
                    input.addEventListener('change', (e) => {
                        const docId = e.target.dataset.docId;
                        const field = e.target.dataset.field;
                        let value = e.target.value;

                        if (field === 'expense' || field === 'startingKM' || field === 'endKM') {
                            value = parseInt(value);
                            if (isNaN(value)) {
                                e.target.value = entry[field];
                                console.error(`Invalid input for ${field}. Please enter a number.`);
                                return;
                            }
                        }
                        updateTripEntry(docId, field, value); // No need to pass appId here, as it's a global
                    });
                });
            }

            // Set a timeout to re-render the table when the 12-hour window expires for this entry
            // This updates the 'Status' column from 'Editable' to 'Locked'
            if (isEditable) {
                const timeRemaining = editableUntil - currentTime;
                // Only set timeout if there's time remaining
                if (timeRemaining > 0) {
                    setTimeout(() => {
                        console.log(`Edit window expired for entry ${entry.id}. Re-rendering table.`);
                        renderTripTable(); // Re-render the table to update status
                    }, timeRemaining + 1000); // Add a small buffer
                }
            }
        });
    }
    updateTotalExpenseDisplay();
}

/**
 * Renders the listing item data into the listing table.
 * Includes increment-only quantity input and +1 button.
 */
function renderListingTable() {
    listingTableBody.innerHTML = '';

    if (listingData.length === 0) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = `<td colspan="4" class="px-6 py-4 whitespace-nowrap text-center text-gray-500">
            No items listed yet.
        </td>`;
        listingTableBody.appendChild(noDataRow);
    } else {
        listingData.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.serialNo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${item.itemName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 flex items-center space-x-2">
                    <input
                        type="number"
                        value="${item.quantity}"
                        min="0"
                        step="1"
                        class="w-20 px-2 py-1 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-100 cursor-not-allowed"
                        data-doc-id="${item.id}"
                        readonly
                    />
                    <button
                        class="px-3 py-1 bg-green-500 text-white text-sm rounded-md shadow-sm hover:bg-green-600 transition duration-200"
                        title="Increment Quantity"
                        data-doc-id="${item.id}"
                    >
                        +1
                    </button>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800">${item.quantity}</td>
            `;
            listingTableBody.appendChild(row);
        });

        listingTableBody.querySelectorAll('button[data-doc-id]').forEach(button => {
            button.addEventListener('click', (e) => {
                const docId = e.target.dataset.docId;
                incrementListingQuantity(docId); // No need to pass appId here
            });
        });
    }
}

/**
 * Increments the quantity of a listing item by 1 in Realtime Database.
 * @param {string} docId - The Realtime Database key (ID) of the item to increment.
 */
async function incrementListingQuantity(docId) {
    if (!db || !userId || !appId) { // Check appId
        console.error("Realtime Database not initialized, user not authenticated, or appId is missing. Cannot increment listing quantity.");
        return;
    }
    const listingEntryRef = window.firebase.ref(db, `artifacts/${appId}/users/${userId}/listings/${docId}`);
    try {
        // Find current item's quantity from the local `listingData` array
        const currentItem = listingData.find(item => item.id === docId);
        if (currentItem) {
             // Update Realtime Database document by incrementing the quantity
             await window.firebase.update(listingEntryRef, { quantity: currentItem.quantity + 1 });
             console.log(`Listing item ${docId} quantity incremented.`);
        }
    } catch (error) {
        console.error("Error incrementing listing quantity:", error.message);
    }
}

// Removed downloadTripDataAsPdf function as it's no longer used

// Removed checkAndEnablePdfButton function as it's no longer used

// --- Event Listeners ---

// Navigation buttons
tripBtn.addEventListener('click', () => navigateTo('tripPage'));
listingBtn.addEventListener('click', () => navigateTo('listingPage'));
backToHomeBtn.addEventListener('click', () => navigateTo('homePage'));

// Trip Page: Add Expense Modal
addTripBtn.addEventListener('click', () => {
    tripModal.classList.remove('hidden');
});

cancelTripBtn.addEventListener('click', () => {
    tripModal.classList.add('hidden');
    tripForm.reset();
});

// Removed event listener for downloadTripPdfBtn

tripForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("Trip form submitted. Initiating Firebase write operation."); // More specific log

    if (!db || !userId || !appId) { // Check appId here too
        console.error("Firebase Realtime Database not initialized, user not authenticated, or appId is missing. Cannot add trip entry.");
        // Consider a small UI message here for the user, e.g., "Database not ready. Please try again."
        return;
    }

    const expense = parseInt(document.getElementById('tripExpense').value);
    const startingKM = parseInt(document.getElementById('tripStartingKM').value);
    const endKM = parseInt(document.getElementById('tripEndKM').value);
    const name = document.getElementById('tripName').value;
    const remarks = document.getElementById('tripRemarks').value;

    if (!isNaN(expense) && !isNaN(startingKM) && !isNaN(endKM) && name) {
        try {
            console.log("Validation passed. Data prepared for Realtime Database push.");
            // Realtime Database: Push new data to the 'trips' node
            // The ref path must exactly match what your security rules allow for writing.
            const tripsRef = window.firebase.ref(db, `artifacts/${appId}/users/${userId}/trips`);
            console.log(`Attempting to push data to RTDB path: artifacts/${appId}/users/${userId}/trips`);

            await window.firebase.push(tripsRef, {
                expense,
                startingKM,
                endKM,
                name,
                remarks,
                submissionTime: Date.now() // Use client-side timestamp for Realtime Database
            });
            console.log('Trip entry added to Realtime Database successfully!');
            tripModal.classList.add('hidden');
            tripForm.reset();
        } catch (error) {
            console.error("Error adding trip document to Realtime Database:", error.message);
            // This catch block is critical. The error.message will contain details from Firebase.
            // Consider displaying a user-friendly error message, e.g., "Failed to save trip. Check your database rules."
        }
    } else {
        console.error('Validation failed: All required fields (Expense, Starting KM, End KM, Name) must be valid numbers/text.');
        // Provide user feedback for validation failure
    }
});

// Listing Page: Add Item Modal
addListingBtn.addEventListener('click', () => {
    listingModal.classList.remove('hidden');
});

cancelListingBtn.addEventListener('click', () => {
    listingModal.classList.add('hidden');
    listingForm.reset();
});

listingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("Listing form submitted. Initiating Firebase write operation.");

    if (!db || !userId || !appId) { // Check appId here too
        console.error("Firebase Realtime Database not initialized, user not authenticated, or appId is missing. Cannot add listing entry.");
        return;
    }

    const itemName = document.getElementById('listingItemName').value;
    const quantity = parseInt(document.getElementById('listingQuantity').value);

    if (itemName && !isNaN(quantity) && quantity >= 1) {
        try {
            console.log("Validation passed. Data prepared for Realtime Database push/update.");
            // Fetch existing items to check for duplicates
            const listingsRef = window.firebase.ref(db, `artifacts/${appId}/users/${userId}/listings`);
            console.log(`Attempting to fetch listings from RTDB path: artifacts/${appId}/users/${userId}/listings`);

            let existingDocKey = null;
            let existingQuantity = 0;

            // Use a one-time value fetch to check for existing items
            const snapshot = await new Promise((resolve, reject) => {
                const unsubscribe = window.firebase.onValue(listingsRef, (snap) => {
                    unsubscribe(); // Unsubscribe immediately after first data
                    resolve(snap);
                }, { onlyOnce: true }, reject); // onlyOnce ensures we don't keep listening
            });

            snapshot.forEach(childSnapshot => {
                if (childSnapshot.val().itemName.toLowerCase() === itemName.toLowerCase()) {
                    existingDocKey = childSnapshot.key;
                    existingQuantity = childSnapshot.val().quantity;
                }
            });

            if (existingDocKey) {
                // Update existing item's quantity
                const itemEntryRef = window.firebase.ref(db, `artifacts/${appId}/users/${userId}/listings/${existingDocKey}`);
                console.log(`Item '${itemName}' already exists. Attempting to update quantity at path: artifacts/${appId}/users/${userId}/listings/${existingDocKey}`);
                await window.firebase.update(itemEntryRef, { quantity: existingQuantity + quantity });
                console.log(`Listing item '${itemName}' quantity updated in Realtime Database successfully.`);
            } else {
                // Add new item
                console.log(`Item '${itemName}' is new. Attempting to push new item to path: artifacts/${appId}/users/${userId}/listings`);
                await window.firebase.push(listingsRef, {
                    itemName,
                    quantity
                });
                console.log(`New listing item '${itemName}' added to Realtime Database successfully.`);
            }

            listingModal.classList.add('hidden');
            listingForm.reset();
        } catch (error) {
            console.error("Error adding/updating listing document in Realtime Database:", error.message);
            // Consider displaying a user-friendly error message
        }
    } else {
        console.error('Validation failed: Item Name is required and Quantity must be a valid number (integer >= 1).');
    }
});

// Initialize Firebase when the DOM is fully loaded, and start checking for PDF libs
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    // Removed checkAndEnablePdfButton call as there's no PDF button anymore
});
