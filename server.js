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
const unCountriesData = require("./modules/unCountries");
const authData = require("./modules/auth-service");
const clientSessions = require('client-sessions');
const bcrypt = require('bcryptjs');
const express = require("express");
const path = require("path");
const app = express();

// Server Configuration
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Checks if the user is logged in and redirects to the login route if not
function ensureLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        res.redirect('/login');
    } else {
        next();
    }
}

// Client session configuration
app.use(clientSessions({
    cookieName: 'session',
    secret: 'yourSecretKeyHere',
    duration: 24 * 60 * 60 * 1000, // 24 hours
    activeDuration: 1000 * 60 * 5 // 5 minutes
}));

// Middleware to make the session available in all templates
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// Server and services initialization
unCountriesData.initialize()
    .then(authData.initialize)
    .then(() => {
        app.listen(8080, () => {
            console.log(`app listening on: 8080`);
        });
    }).catch(error => {
        console.log(`unable to start server: ${error}`);
    });

// Configuration of static directories
app.use(express.static('public'));

// Tests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    if (req.method === 'POST') {
        console.log('POST request body:', req.body);
    }
    next();
});
// Tests

// Routes
// Home page
app.get("/", (req, res) => {
    res.render("home");
});

// About page
app.get("/about", (req, res) => {
    res.render("about");
});

// List of UN countries by region
app.get("/un/countries", (req, res) => {
    const { region } = req.query;
    if (region) {
        unCountriesData.getCountriesByRegion(region)
            .then(countries => res.render("countries", { countries }))
            .catch(error => res.status(500).send(error));
    } else {
        unCountriesData.getAllCountries()
            .then(allCountries => res.render("countries", { countries: allCountries }))
            .catch(error => res.status(500).send(error));
    }
});

// Details of a specific country
app.get("/un/countries/:countryCode", (req, res) => {
    const countryCode = req.params.countryCode;
    unCountriesData.getCountryByCode(countryCode)
        .then(country => {
            if (!country) {
                return res.status(404).render("404", { message: "I'm sorry, we're unable to find what you're looking for." });
            }
            res.render("country", { country: country });
        })
        .catch(error => res.status(404).render("404", { message: "An error occurred while trying to find the country" }));
});

// Add country
app.get("/un/addCountry", ensureLogin, (req, res) => {
    unCountriesData.getAllRegions()
        .then(regions => {
            res.render("addCountry", { regions: regions });
        })
        .catch(err => {
            res.status(500).render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});

// Process country addition
app.post("/un/addCountry", (req, res) => {
    // Encrypt the password before saving it to the database
    bcrypt.hash(req.body.password, 10)
        .then(hash => {
            req.body.password = hash;
            // Add country to the database
            unCountriesData.addCountry(req.body)
                .then(() => {
                    res.redirect("/un/countries");
                })
                .catch(err => {
                    res.status(500).render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
                });
        })
        .catch(err => {
            res.status(500).render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});

// Edit country
app.get("/un/editCountry/:code", (req, res) => {
    if (!req.session.user) {
        res.redirect('/login');
    } else {
        let countryCode = req.params.code;
        let countryData;
        let regionsData;

        unCountriesData.getCountryByCode(countryCode)
            .then(country => {
                if (!country) {
                    throw new Error("Unable to find the requested country");
                }
                countryData = country;
                return unCountriesData.getAllRegions();
            })
            .then(regions => {
                regionsData = regions;
                res.render("editCountry", { regions: regionsData, country: countryData });
            })
            .catch(err => {
                res.status(404).render("404", { message: err });
            });
    }
});

// Process country edit
app.post("/un/editCountry", (req, res) => {
    let countryCode = req.body.a2code;
    let countryData = req.body;

    unCountriesData.editCountry(countryCode, countryData)
        .then(() => {
            res.redirect("/un/countries");
        })
        .catch(err => {
            res.status(500).render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});

// Delete country
app.get("/un/deleteCountry/:code", ensureLogin, (req, res) => {
    let countryCode = req.params.code;

    unCountriesData.deleteCountry(countryCode)
        .then(() => {
            res.redirect("/un/countries");
        })
        .catch(err => {
            res.status(500).render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});

// Route to log out the user
app.get("/logout", ensureLogin, (req, res) => {
    req.session.reset();
    res.redirect('/');
});

// Function to format the date
function formatDate(date) {
    let options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    let formattedDate = date.toLocaleDateString('en-US', options);

    // Remove commas
    formattedDate = formattedDate.replace(/,/g, '');

    // Add time zone
    let timeZone = "GMT" + (date.getTimezoneOffset() > 0 ? "-" : "+") + Math.abs(date.getTimezoneOffset() / 60).toString().padStart(2, '0') + "00";

    return `${formattedDate} ${timeZone} (Coordinated Universal Time)`;
}

// Route to render the user history page
app.get("/userHistory", ensureLogin, (req, res) => {
    res.render("userHistory", { formatDate: formatDate });
});

// Route renders the dashboard page if the user is logged in
app.get('/dashboard', ensureLogin, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

// Route to render the login page
app.get('/login', function(req, res) {
    let errorMessage = req.session.error;
    req.session.error = null; // clear the error message after storing it
    res.render('login', { errorMessage: errorMessage });
});

// Route to process user login
app.post("/login", (req, res) => {
    req.body.userAgent = req.get('User-Agent');
    authData.checkUser(req.body)
        .then(user => {
            req.session.user = {
                userName: user.userName,
                email: user.email,
                loginHistory: user.loginHistory
            };
            res.redirect('/un/countries');
        })
        .catch(err => {
            req.session.error = err;
            res.redirect('/login');
        });
});

// Route to render the register page
app.get("/register", function(req, res) {
    res.render('register', { successMessage: '', errorMessage: '' });
});

// Route to process user registration
app.post("/register", (req, res) => {
    authData.registerUser(req.body)
        .then(user => {
            res.redirect("/login"); // Redirect to login page after successful registration
        })
        .catch(err => {
            res.render("register", { errorMessage: err, userName: req.body.userName, successMessage: '' });
        });
});

// 404 Page
app.use((req, res) => {
    res.status(404).render("404", { message: "I'm sorry, we're unable to find what you're looking for" });
});
