const MUSIC_TRACKS = [
  {
    name: "Song 1",
    src: "music/song1.mp3"
  },
  {
    name: "Song 2",
    src: "music/song2.mp3"
  },
  {
    name: "Song 3",
    src: "music/song3.mp3"
  },
  {
    name: "Song 4",
    src: "music/song4.mp3"
  },
  {
    name: "Song 5",
    src: "music/song5.mp3"
  },
  {
    name: "Song 6",
    src: "music/song6.mp3"
  }
];

const musicToggleBtn = document.getElementById("musicToggle");
const musicNextBtn = document.getElementById("musicNext");
const musicVolumeBtn = document.getElementById("musicVolumeBtn");
const musicLabel = document.getElementById("musicLabel");

const musicAudio = new Audio();

let musicIndex = 0;
let musicOn = true;
let musicStarted = false;

const volumeLevels = [0, 0.25, 0.5, 0.8];
let volumeIndex = 2;

function currentTrack() {
  return MUSIC_TRACKS[musicIndex];
}

function updateMusicLabel() {
  if (!musicOn) {
    musicLabel.textContent = "♪ Off";
    return;
  }

  musicLabel.textContent = `♪ ${musicIndex + 1}/${MUSIC_TRACKS.length}`;
}

function updateVolumeButton() {
  const volume = volumeLevels[volumeIndex];

  musicAudio.volume = volume;

  musicVolumeBtn.textContent = `Vol ${Math.round(volume * 100)}%`;
}

function playCurrentTrack(attempts = 0) {
  if (!musicOn) {
    updateMusicLabel();
    return;
  }

  const track = currentTrack();

  musicAudio.src = track.src;
  musicAudio.volume = volumeLevels[volumeIndex];

  musicAudio
    .play()
    .then(() => {
      updateMusicLabel();
    })
    .catch(() => {
      // If a song file is missing, try the next one.
      if (attempts < MUSIC_TRACKS.length) {
        musicIndex = (musicIndex + 1) % MUSIC_TRACKS.length;
        playCurrentTrack(attempts + 1);
      } else {
        musicOn = false;
        updateMusicLabel();
      }
    });
}

function nextTrack() {
  musicIndex = (musicIndex + 1) % MUSIC_TRACKS.length;

  if (musicOn) {
    playCurrentTrack();
  } else {
    updateMusicLabel();
  }
}

function ensureMusicStarted() {
  if (!musicOn) return;

  if (!musicStarted) {
    musicStarted = true;
    playCurrentTrack();
  } else if (musicAudio.paused) {
    musicAudio.play().catch(() => {
      // Do nothing. Browser may block autoplay until user interacts.
    });
  }
}

musicAudio.addEventListener("ended", () => {
  nextTrack();
});

musicToggleBtn.addEventListener("click", () => {
  musicOn = !musicOn;

  if (musicOn) {
    musicStarted = true;
    playCurrentTrack();
  } else {
    musicAudio.pause();
    updateMusicLabel();
  }
});

musicNextBtn.addEventListener("click", () => {
  musicOn = true;
  musicStarted = true;
  nextTrack();
});

musicVolumeBtn.addEventListener("click", () => {
  volumeIndex = (volumeIndex + 1) % volumeLevels.length;
  updateVolumeButton();
});

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

if (startBtn) {
  startBtn.addEventListener("click", ensureMusicStarted);
}

if (restartBtn) {
  restartBtn.addEventListener("click", ensureMusicStarted);
}

updateVolumeButton();
updateMusicLabel();
