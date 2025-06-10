const firebaseConfig = {
    apiKey: "AIzaSyDYdD9tyrDmiFi1fYKd6lvLiKICKLWVmnY",
            authDomain: "ad-associates-official.firebaseapp.com",
            databaseURL: "https://ad-associates-official-default-rtdb.firebaseio.com",
            projectId: "ad-associates-official",
            storageBucket: "ad-associates-official.firebasestorage.app",
            messagingSenderId: "407411380354",
            appId: "1:407411380354:web:f72766d2d3d5e14fdca49b",
            measurementId: "G-T822NHJHWP"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM elements
const navButtons = document.querySelectorAll('.nav-button');
const contentSections = document.querySelectorAll('.content-section');
const goToTripsBtn = document.getElementById('goToTripsBtn');
const goToListingsBtn = document.getElementById('goToListingsBtn');
const addTripButton = document.getElementById('addTripButton');
const addListingButton = document.getElementById('addListingButton');
const popupOverlay = document.getElementById('dataEntryPopup');
const popupTitle = document.getElementById('popupTitle');
const popupForm = document.getElementById('popupForm');
const closePopup = document.getElementById('closePopup');
const totalFuelExpense = document.getElementById('totalFuelExpense');

// State variables
let currentPopupType = null;
let editingId = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Navigation functionality
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active nav button
            navButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding section
            const targetSection = this.id.replace('nav', '').toLowerCase() + 'Section';
            contentSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetSection) {
                    section.classList.add('active');
                }
            });
        });
    });

    // Home page buttons
    goToTripsBtn.addEventListener('click', () => {
        document.getElementById('navTrips').click();
    });
    
    goToListingsBtn.addEventListener('click', () => {
        document.getElementById('navListings').click();
    });

    // Add buttons
    addTripButton.addEventListener('click', () => showTripPopup());
    addListingButton.addEventListener('click', () => showListingPopup());

    // Close popup
    closePopup.addEventListener('click', () => {
        popupOverlay.style.display = 'none';
        popupForm.reset();
        editingId = null;
    });

    // Load data from Firebase
    loadTrips();
    loadListings();
});

// Show trip entry popup
function showTripPopup(id = null) {
    currentPopupType = 'trip';
    editingId = id;
    
    popupTitle.textContent = id ? 'Edit Trip Entry' : 'Add New Trip';
    popupForm.innerHTML = `
        <label for="fuelExpense">Fuel Expense (₹):</label>
        <input type="number" id="fuelExpense" name="fuelExpense" required>
        
        <label for="startKm">Starting KM:</label>
        <input type="number" id="startKm" name="startKm" required>
        
        <label for="endKm">End KM:</label>
        <input type="number" id="endKm" name="endKm" required>
        
        <label for="name">Name:</label>
        <input type="text" id="name" name="name" required>
        
        <label for="remarks">Remarks:</label>
        <textarea id="remarks" name="remarks"></textarea>
    `;
    
    // If editing, populate with existing data
    if (id) {
        database.ref('trips/' + id).once('value').then(snapshot => {
            const data = snapshot.val();
            document.getElementById('fuelExpense').value = data.fuelExpense;
            document.getElementById('startKm').value = data.startKm;
            document.getElementById('endKm').value = data.endKm;
            document.getElementById('name').value = data.name;
            document.getElementById('remarks').value = data.remarks || '';
        });
    }
    
    popupOverlay.style.display = 'flex';
}

// Show listing entry popup
function showListingPopup(id = null) {
    currentPopupType = 'listing';
    editingId = id;
    
    popupTitle.textContent = id ? 'Edit Item Listing' : 'Add New Item';
    popupForm.innerHTML = `
        <label for="itemName">Item Name:</label>
        <input type="text" id="itemName" name="itemName" required>
        
        <label for="quantity">Quantity:</label>
        <input type="number" id="quantity" name="quantity" required>
        
        <label for="totalQuantity">Total Quantity:</label>
        <input type="number" id="totalQuantity" name="totalQuantity" required>
    `;
    
    // If editing, populate with existing data
    if (id) {
        database.ref('listings/' + id).once('value').then(snapshot => {
            const data = snapshot.val();
            document.getElementById('itemName').value = data.itemName;
            document.getElementById('quantity').value = data.quantity;
            document.getElementById('totalQuantity').value = data.totalQuantity;
        });
    }
    
    popupOverlay.style.display = 'flex';
}

// Form submission handler
popupForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());
    
    if (currentPopupType === 'trip') {
        saveTrip(data);
    } else if (currentPopupType === 'listing') {
        saveListing(data);
    }
    
    popupOverlay.style.display = 'none';
    this.reset();
    editingId = null;
});

// Save trip to Firebase
function saveTrip(data) {
    const tripData = {
        fuelExpense: parseFloat(data.fuelExpense),
        startKm: parseInt(data.startKm),
        endKm: parseInt(data.endKm),
        name: data.name,
        remarks: data.remarks || '',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    if (editingId) {
        // Update existing trip
        database.ref('trips/' + editingId).update(tripData);
    } else {
        // Add new trip
        database.ref('trips').push(tripData);
    }
}

// Save listing to Firebase
function saveListing(data) {
    const listingData = {
        itemName: data.itemName,
        quantity: parseInt(data.quantity),
        totalQuantity: parseInt(data.totalQuantity),
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    
    if (editingId) {
        // Update existing listing
        database.ref('listings/' + editingId).update(listingData);
    } else {
        // Add new listing
        database.ref('listings').push(listingData);
    }
}

// Load trips from Firebase and display in table
function loadTrips() {
    const tripTableBody = document.querySelector('#tripTable tbody');
    let totalExpense = 0;
    
    database.ref('trips').on('value', (snapshot) => {
        tripTableBody.innerHTML = '';
        totalExpense = 0;
        let serialNo = 1;
        
        snapshot.forEach(childSnapshot => {
            const trip = childSnapshot.val();
            const tripId = childSnapshot.key;
            totalExpense += trip.fuelExpense;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${serialNo}</td>
                <td contenteditable="true" data-field="fuelExpense" data-id="${tripId}">${trip.fuelExpense}</td>
                <td contenteditable="true" data-field="startKm" data-id="${tripId}">${trip.startKm}</td>
                <td contenteditable="true" data-field="endKm" data-id="${tripId}">${trip.endKm}</td>
                <td contenteditable="true" data-field="name" data-id="${tripId}">${trip.name}</td>
                <td contenteditable="true" data-field="remarks" data-id="${tripId}">${trip.remarks || ''}</td>
            `;
            
            // Add edit button
            const editCell = document.createElement('td');
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.className = 'increment-button';
            editButton.addEventListener('click', () => showTripPopup(tripId));
            editCell.appendChild(editButton);
            row.appendChild(editCell);
            
            tripTableBody.appendChild(row);
            serialNo++;
        });
        
        totalFuelExpense.textContent = totalExpense.toFixed(2);
    });
    
    // Handle inline edits
    tripTableBody.addEventListener('focusout', (e) => {
        const cell = e.target;
        if (cell.hasAttribute('contenteditable')){
            const field = cell.getAttribute('data-field');
            const id = cell.getAttribute('data-id');
            const newValue = cell.textContent.trim();
            
            const updates = {};
            updates[field] = field === 'fuelExpense' ? parseFloat(newValue) : 
                            (field === 'startKm' || field === 'endKm') ? parseInt(newValue) : newValue;
            
            database.ref('trips/' + id).update(updates);
        }
    });
}

// Load listings from Firebase and display in table
function loadListings() {
    const listingTableBody = document.querySelector('#listingTable tbody');
    
    database.ref('listings').on('value', (snapshot) => {
        listingTableBody.innerHTML = '';
        let serialNo = 1;
        
        snapshot.forEach(childSnapshot => {
            const listing = childSnapshot.val();
            const listingId = childSnapshot.key;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${serialNo}</td>
                <td contenteditable="true" data-field="itemName" data-id="${listingId}">${listing.itemName}</td>
                <td contenteditable="true" data-field="quantity" data-id="${listingId}">${listing.quantity}</td>
                <td contenteditable="true" data-field="totalQuantity" data-id="${listingId}">${listing.totalQuantity}</td>
            `;
            
            // Add edit button
            const editCell = document.createElement('td');
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            editButton.className = 'increment-button';
            editButton.addEventListener('click', () => showListingPopup(listingId));
            editCell.appendChild(editButton);
            row.appendChild(editCell);
            
            listingTableBody.appendChild(row);
            serialNo++;
        });
    });
    
    // Handle inline edits
    listingTableBody.addEventListener('focusout', (e) => {
        const cell = e.target;
        if (cell.hasAttribute('contenteditable')) {
            const field = cell.getAttribute('data-field');
            const id = cell.getAttribute('data-id');
            const newValue = cell.textContent.trim();
            
            const updates = {};
            updates[field] = (field === 'quantity' || field === 'totalQuantity') ? parseInt(newValue) : newValue;
            
            database.ref('listings/' + id).update(updates);
        }
    });
}