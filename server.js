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
const unCountriesData = require("./modules/unCountries");
const authData = require("./modules/auth-service");
const clientSessions = require('client-sessions');
const bcrypt = require('bcryptjs');
const express = require("express");
const path = require("path");
const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

function ensureLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        res.redirect('/login');
    } else {
        next();
    }
}

app.use(clientSessions({
    cookieName: 'session',
    secret: 'yourSecretKeyHere',
    duration: 24 * 60 * 60 * 1000,
    activeDuration: 1000 * 60 * 5
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

unCountriesData.initialize()
    .then(authData.initialize)
    .then(() => {
        app.listen(8080, () => {
            console.log(`app listening on: 8080`);
        });
    }).catch(error => {
        console.log(`unable to start server: ${error}`);
    });

app.use(express.static('public'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    if (req.method === 'POST') {
        console.log('POST request body:', req.body);
    }
    next();
});

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/about", (req, res) => {
    res.render("about");
});
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

app.get("/un/addCountry", ensureLogin, (req, res) => {
    unCountriesData.getAllRegions()
        .then(regions => {
            res.render("addCountry", { regions: regions });
        })
        .catch(err => {
            res.status(500).render("500", { message: `I'm sorry, but we have encountered the following error: ${err}` });
        });
});

app.post("/un/addCountry", (req, res) => {
    bcrypt.hash(req.body.password, 10)
        .then(hash => {
            req.body.password = hash;
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

app.get("/logout", ensureLogin, (req, res) => {
    req.session.reset();
    res.redirect('/');
});

function formatDate(date) {
    let options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    let formattedDate = date.toLocaleDateString('en-US', options);

    formattedDate = formattedDate.replace(/,/g, '');

    let timeZone = "GMT" + (date.getTimezoneOffset() > 0 ? "-" : "+") + Math.abs(date.getTimezoneOffset() / 60).toString().padStart(2, '0') + "00";

    return `${formattedDate} ${timeZone} (Coordinated Universal Time)`;
}
app.get("/userHistory", ensureLogin, (req, res) => {
    res.render("userHistory", { formatDate: formatDate });
});

app.get('/dashboard', ensureLogin, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

app.get('/login', function(req, res) {
    let errorMessage = req.session.error;
    req.session.error = null;
    res.render('login', { errorMessage: errorMessage });
});

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

app.get("/register", function(req, res) {
    res.render('register', { successMessage: '', errorMessage: '' });
});

app.post("/register", (req, res) => {
    authData.registerUser(req.body)
        .then(user => {
            res.redirect("/login");
        })
        .catch(err => {
            res.render("register", { errorMessage: err, userName: req.body.userName, successMessage: '' });
        });
});

app.use((req, res) => {
    res.status(404).render("404", { message: "I'm sorry, we're unable to find what you're looking for" });
});
