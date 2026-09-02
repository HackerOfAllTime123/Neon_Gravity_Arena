# Neon Gravity - Secret Edition

A neon arcade browser game with levels, time limits, hidden secrets, cheat codes, gravity physics, angular momentum movement, and background music.

## Gameplay

- Collect energy orbs before time runs out.
- Each level has a target number of orbs.
- The black hole pulls you toward the center.
- Moving sideways while falling can create angular momentum.
- You can use momentum to orbit, swing, or escape the black hole.
- A red hunter drone chases you.
- If the hunter touches you, you lose a life.
- If the black hole consumes you, you lose a life.
- Completing a level gives a time bonus.
- Every 3 levels can give a bonus life.

## Controls

### Desktop

Move with:

- WASD
- Arrow Keys

Secret cheat codes are typed during gameplay.

### Mobile

Touch and drag anywhere to move.

Secret cheat gesture:

1. Tap top-left corner 3 times.
2. Tap top-right corner 3 times.
3. Enter secret code.

## Background Music

This game supports a local music playlist.

Create a folder named:

```txt
music/
```

Add your songs:

```txt
music/song1.mp3
music/song2.mp3
music/song3.mp3
music/song4.mp3
music/song5.mp3
music/song6.mp3
```

If you only have 5 songs, delete the `song6` entry inside `music.js`.

Music controls:

- `♪` button: turn music on/off
- `Next` button: play next song
- `Vol` button: change volume

## Music Copyright Warning

Only use songs that you own or have permission to use.

If your GitHub repository is public, do not upload copyrighted songs unless you have the right to distribute them.

For public repositories, use royalty-free music or music you created yourself.

## Tech

This is a static browser game made with:

- HTML
- CSS
- JavaScript
- HTML5 Canvas

No server is required.

## Deploy to GitHub Pages

1. Create a public GitHub repository.
2. Upload all files to the repository.
3. Upload your songs into the `music/` folder.
4. Go to repository **Settings**.
5. Open **Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select branch **main** and folder **/ (root)**.
8. Save.

Your game will be available at:

```txt
https://YOUR_USERNAME.github.io/YOUR_REPOSITORY_NAME/
```

For this repository:

```txt
https://hackerofalltime123.github.io/Neon_Gravity/
```

## License

MIT License.
