CREATE TABLE users
(
    id INT PRIMARY KEY IDENTITY (1, 1),
    spotify_id VARCHAR (100),
    username VARCHAR (25),
    photo VARCHAR (500)
);

CREATE TABLE jukebox_venue
(
    id INT PRIMARY KEY IDENTITY (1, 1),
    venue_name VARCHAR (25),
    venue_location GEOGRAPHY
)

CREATE TABLE song_requests
(
    id INT PRIMARY KEY IDENTITY (1, 1),
    song_id VARCHAR (100) NOT NULL,
    user_id INT NOT NULL,
    venue INT NOT NULL,
    FOREIGN KEY (venue) REFERENCES jukebox_venue (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
)