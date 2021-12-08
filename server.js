require("dotenv/config");
const express = require('express')
const passport = require("passport");
const sql = require('mssql');
const session = require("express-session");
const bodyParser = require("body-parser");
const SpotifyStrategy = require('passport-spotify').Strategy;
const { sample } = require("lodash");
const got = require('got');

const app = express();

/** Our sql wrapper
 * This will grab the result of the first select statement.
 */
async function sqlQuery(...args) {
    const result = await sql.query(...args);
    return result?.recordsets?.[0]?.[0];
}

/** SQL Query */
function findUserBySpotifyId(spotifyId) {
    return sqlQuery/* sql */`
    SELECT * FROM users
    WHERE spotify_id = ${spotifyId}
    `;
}

/** SQL Query */
function findUserById(id) {
    return sqlQuery/* sql */`
    SELECT * FROM users
    WHERE id = ${id}
    `;
}

/** passport (authentication and authorization) */
passport.serializeUser(function(user, done) {
  done(null, user?.id);
});

passport.deserializeUser(async function (id, done) {
    try {
        const user = await findUserById(id);
        done(null, user);
    } catch (err) {
        console.error(err);
        done(new Error("Auth Error: Couldn't deserialize user from DB"));
    }
});

/** Spotify Passport (for authentication and authorization through spotify) */
passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: process.env.SPOTIFY_CALLBACK_URL,
      passReqToCallback: true,
    },
    async function(req, accessToken, refreshToken, expires_in, profile, done) {
        try {
            req.session.accessToken = accessToken;
            req.session.refreshToken = refreshToken;
            // We use the spotify api docs for profile to find the value https://developer.spotify.com/documentation/web-api/reference/#/operations/get-users-profile
            let user = await findUserBySpotifyId(profile.id);
            
            if (!user) {
                await sqlQuery/* sql */`
                INSERT INTO users (
                    spotify_id,
                    username,
                    photo
                )
                VALUES (
                    ${profile.id},
                    ${profile.displayName},
                    ${profile.photos?.[0]?.value}
                )
                `;
                user = await findUserBySpotifyId(profile.id);
            }
            done(null, user)        
        } catch(err) {
            console.error(err);
            done(new Error("Error signing in with Spotify"))
        }      
    }
  )
);

app.use(express.static("public"));
// set the view engine to ejs
app.set('view engine', 'ejs');

// setup passport dependencies
app.use(session({ secret: process.env.SESSION_SECRET }));
app.use(bodyParser.urlencoded({ extended: false }));
// setup passport
app.use(passport.initialize());
app.use(passport.session());

// handle errors
app.use(function(err, req, res, next) {
  console.error(err.message); // Log error message in our server's console
  if (!err.statusCode) err.statusCode = 500; // If err has no specified error code, set error code to 'Internal Server Error (500)'
  res.status(err.statusCode).send(err.message); // All HTTP requests must have a response, so let's send back an error with its status code and message
});



function isLoggedIn(req, res, next) {
    if (!req.user) {
        res.redirect("/login")
        return;
    }
    next();
}


app.get("/", isLoggedIn, (req, res) => {
    res.render("index", {
        user: req.user
    });
})

app.get("/track/:id", isLoggedIn, (req, res) => {
    res.render("track");
})

app.get("/login", (req, res) => {
    res.render("login");
})
    
app.get('/auth/spotify', passport.authenticate('spotify'));

app.get(
  '/auth/spotify/callback',
  passport.authenticate('spotify', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

const APIRouter = express.Router();

// handle errors
APIRouter.use(function(err, req, res, next) {
  console.error(err.message); // Log error message in our server's console
  if (!err.statusCode) err.statusCode = 500; // If err has no specified error code, set error code to 'Internal Server Error (500)'
  res.status(err.statusCode).json({error: err.message}); // All HTTP requests must have a response, so let's send back an error with its status code and message
});


// Handles all spotify get requests (it's basically just a proxy to the spotify api along with the credentials our user logged in with!)
// (security measures such as whitelisting / blacklisting url paths or parameters isn't that important as get requests only read and don't write data.)
APIRouter.get(
    '/api/spotify/:path',
    isLoggedIn,
    async function (req, res) {
        if (!req.session.accessToken) {
            throw new Error("Session expired please login again.");
        }
        const result = await got(process.env.SPOTIFY_API_URL + req.params.path, {
            searchParams: req.query,
            headers: {
                'Authorization': 'Bearer ' + req.session.accessToken
            },
            responseType: 'json'
        });
        res.json(result.body);
    }
);

// Gets our user!
APIRouter.get(
    '/api/me',
    isLoggedIn,
    async function (req, res) {
        res.json(req.user);
    }
);

app.use(APIRouter);

;(async () => {
    await sql.connect({
        user: process.env.MSSQL_USER,
        password: process.env.SA_PASSWORD,
        database: process.env.MSSQL_DB,
        server: process.env.MSSQL_IP,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        },
        options: {
            encrypt: process.env !== "development", // for azure
            trustServerCertificate: process.env.NODE_ENV === "development"
        },
        port: 1433
    });
    
    const port = process.env.PORT;
    app.listen(port, () => {
        console.log(`🚀 Spotify API example app listening on http://localhost:${port}`)
    });
})();