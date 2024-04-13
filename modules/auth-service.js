/********************************************************************************
* WEB322 – Assignment 06
*
* I declare that this assignment is my own work in accordance with Seneca's
* Academic Integrity Policy:
*
* https://www.senecacollege.ca/about/policies/academic-integrity-policy.html
*
* Name: Tabir Ahmed Student ID: 135460236 Date: 2024-04-12
*
* Published URL:
*
********************************************************************************/
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Define MongoDB connection URI
const MONGODB_URI = process.env.MONGODB_URI;

// Check if MongoDB URI is defined
if (!MONGODB_URI) {
    console.error('MongoDB URI is not defined in the environment variables.');
    process.exit(1); // Exit the application
}

// Defining connection to MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit the application
});

// Creating user schema
const Schema = mongoose.Schema;
const userSchema = new Schema({
    userName: { type: String, unique: true },
    password: String,
    email: String,
    loginHistory: [{
        dateTime: { type: Date, default: Date.now },
        userAgent: String
    }]
});

// Creating user model
let User = mongoose.model('User', userSchema);

// Function to initialize MongoDB connection and define User model
let initialize = () => {
    return new Promise(function (resolve, reject) {
        let db = mongoose.createConnection(MONGODB_URI);

        db.on('error', (err) => {
            reject(err); // reject the promise with the provided error
        });
        db.once('open', () => {
            User = db.model("User", userSchema);
            resolve();
        });
    });
};

// Function to register a new user
let registerUser = (userData) => {
    console.log("registerUser function called with data:", userData); // Added here
    return new Promise((resolve, reject) => {
        // Check if passwords match
        if (userData.password !== userData.password2) {
            reject("Passwords do not match");
            return;
        }

        // Encrypt user's password
        bcrypt.hash(userData.password, 10)
            .then(hash => {
                console.log("Password hashed successfully"); // Added here
                // Replace user's password with the hashed version
                userData.password = hash;

                // Create a new user with the provided data
                let newUser = new User(userData);
                console.log("New user created:", newUser); // Added here

                // Save the new user to the database
                newUser.save()
                    .then(() => {
                        console.log("User saved successfully!"); // Added here
                        resolve("User created successfully!");
                    })
                    .catch((err) => {
                        console.log("Error saving user:", err); // Added here
                        if (err.code === 11000) {
                            reject("User Name already taken");
                        } else {
                            reject(`There was an error creating the user: ${err}`);
                        }
                    });
            })
            .catch(err => {
                console.log("Error hashing password:", err); // Added here
                reject("There was an error encrypting the password");
            });
    });
};

// Function to check user
let checkUser = (userData) => {
    return new Promise((resolve, reject) => {
        // Find a user with the provided userName
        User.find({ userName: userData.userName })
            .then((users) => {
                // Check if user was found
                if (users.length === 0) {
                    reject(`Unable to find user: ${userData.userName}`);
                    return;
                }

                // Check if password is correct
                bcrypt.compare(userData.password, users[0].password)
                    .then(result => {
                        if (!result) {
                            reject(`Incorrect password for user: ${userData.userName}`);
                            return;
                        }

                        // Add the most recent entry to the login history
                        if (users[0].loginHistory.length === 8) {
                            users[0].loginHistory.pop();
                        }
                        users[0].loginHistory.unshift({ dateTime: new Date().toString(), userAgent: userData.userAgent });

                        // Update user's login history
                        User.updateOne({ userName: users[0].userName }, { $set: { loginHistory: users[0].loginHistory } })
                            .then(() => {
                                resolve(users[0]);
                            })
                            .catch((err) => {
                                reject(`There was an error verifying the user: ${err}`);
                            });
                    })
                    .catch(err => {
                        reject(`There was an error comparing passwords: ${err}`);
                    });
            })
            .catch(() => {
                reject(`Unable to find user: ${userData.userName}`);
            });
    });
};

// Exporting functions
module.exports = { User, initialize, registerUser, checkUser };
