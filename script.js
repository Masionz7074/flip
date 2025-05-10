document.getElementById('unlockBtn').addEventListener('click', unlockData);

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
    const enteredPassword = prompt("Please enter the password:");

    if (enteredPassword === correctPassword) {
        // Password is correct (client-side check - INSECURE)
        displayData();
    } else {
        // Password is incorrect
        alert("Incorrect password.");
    }
}

function displayData() {
    const dataContainer = document.getElementById('dataContainer');
    const dataOutput = document.getElementById('dataOutput');
    const unlockBtn = document.getElementById('unlockBtn');

    // Show the data container and hide the button
    dataContainer.classList.remove('hidden');
    unlockBtn.classList.add('hidden');

    // Display the data in the <pre> tag
    // Use JSON.stringify to format the JavaScript object nicely
    dataOutput.textContent = JSON.stringify(myDatabaseData, null, 4); // null, 4 for pretty printing
}