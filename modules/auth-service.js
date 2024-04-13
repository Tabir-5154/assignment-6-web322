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
* Published URL:https://worrisome-sweatshirt-fish.cyclic.app
*
********************************************************************************/
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MongoDB URI is not defined in the environment variables.');
    process.exit(1);
}

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

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

let User = mongoose.model('User', userSchema);

let initialize = () => {
    return new Promise(function (resolve, reject) {
        let db = mongoose.createConnection(MONGODB_URI);

        db.on('error', (err) => {
            reject(err);
        });
        db.once('open', () => {
            User = db.model("User", userSchema);
            resolve();
        });
    });
};

let registerUser = (userData) => {
    console.log("registerUser function called with data:", userData);
    return new Promise((resolve, reject) => {
        if (userData.password !== userData.password2) {
            reject("Passwords do not match");
            return;
        }

        bcrypt.hash(userData.password, 10)
            .then(hash => {
                console.log("Password hashed successfully");
                userData.password = hash;

                let newUser = new User(userData);
                console.log("New user created:", newUser);

                newUser.save()
                    .then(() => {
                        console.log("User saved successfully!");
                        resolve("User created successfully!");
                    })
                    .catch((err) => {
                        console.log("Error saving user:", err);
                        if (err.code === 11000) {
                            reject("User Name already taken");
                        } else {
                            reject(`There was an error creating the user: ${err}`);
                        }
                    });
            })
            .catch(err => {
                console.log("Error hashing password:", err);
                reject("There was an error encrypting the password");
            });
    });
};

let checkUser = (userData) => {
    return new Promise((resolve, reject) => {
        User.find({ userName: userData.userName })
            .then((users) => {
                if (users.length === 0) {
                    reject(`Unable to find user: ${userData.userName}`);
                    return;
                }

                bcrypt.compare(userData.password, users[0].password)
                    .then(result => {
                        if (!result) {
                            reject(`Incorrect password for user: ${userData.userName}`);
                            return;
                        }

                        if (users[0].loginHistory.length === 8) {
                            users[0].loginHistory.pop();
                        }
                        users[0].loginHistory.unshift({ dateTime: new Date().toString(), userAgent: userData.userAgent });

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

module.exports = { User, initialize, registerUser, checkUser };
