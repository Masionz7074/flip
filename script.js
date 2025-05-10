const passwordInput = document.getElementById('passwordInput');
const unlockBtn = document.getElementById('unlockBtn');
const passwordInputArea = document.getElementById('passwordInputArea'); // Get the input area div
const dataContainer = document.getElementById('dataContainer');
const dataOutput = document.getElementById('dataOutput');


unlockBtn.addEventListener('click', unlockData);

// Allow pressing Enter in the password field to trigger the button click
passwordInput.addEventListener('keypress', function(event) {
    // Check if the key pressed was the Enter key (key code 13)
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent default form submission if it were in a form
        unlockData(); // Call the unlock function
    }
});


// --- HARDCODED PASSWORD AND DATA ---
// !!! WARNING: THIS IS NOT SECURE. BOTH ARE VISIBLE IN THE SOURCE CODE. !!!
const correctPassword = "muskiead";

// This is your "database" - just a JavaScript object/array hardcoded here.
// It cannot be updated dynamically by another website using this static setup.
const myDatabaseData = {
    users: [
        { id: 1, name: "Alice", status: "active" },
        { id: 2, name: "Bob", status: "inactive" }
    ],
    settings: {
        theme: "dark",
        language: "en"
    },
    // Add whatever data structure you need here
    inventory: [
        { item: "Sword", quantity: 5 },
        { item: "Potion", quantity: 10 }
    ]
};
// --- END HARDCODED DATA ---


function unlockData() {
    const enteredPassword = passwordInput.value; // Get value from the input field

    if (enteredPassword === correctPassword) {
        // Password is correct (client-side check - INSECURE)
        displayData();
    } else {
        // Password is incorrect
        alert("Incorrect password.");
        // Clear the input field
        passwordInput.value = "";
    }
}

function displayData() {
    // Hide the password input area and show the data container
    passwordInputArea.classList.add('hidden');
    dataContainer.classList.remove('hidden');

    // Display the data in the <pre> tag
    dataOutput.textContent = JSON.stringify(myDatabaseData, null, 4); // null, 4 for pretty printing
}
