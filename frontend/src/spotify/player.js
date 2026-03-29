const SPOTIFY_SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';

let sdkLoadPromise = null;

function injectSpotifySdkScript() {
  if (document.querySelector(`script[src="${SPOTIFY_SDK_SRC}"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.src = SPOTIFY_SDK_SRC;
  script.async = true;
  document.body.appendChild(script);
}

export function loadSpotifySDK() {
  if (window.Spotify) {
    return Promise.resolve(window.Spotify);
  }

  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out loading Spotify Web Playback SDK'));
      }, 12000);

      window.onSpotifyWebPlaybackSDKReady = () => {
        clearTimeout(timeout);
        resolve(window.Spotify);
      };

      injectSpotifySdkScript();
    });
  }

  return sdkLoadPromise;
}

export async function createSpotifyPlayer({
  name,
  volume = 0.8,
  getOAuthToken,
  onReady,
  onNotReady,
  onStateChange,
  onInitializationError,
  onAuthenticationError,
  onAccountError,
  onPlaybackError
}) {
  const Spotify = await loadSpotifySDK();

  if (!Spotify?.Player) {
    throw new Error('Spotify Web Playback SDK is not available');
  }

  const player = new Spotify.Player({
    name: name || 'HarmonyHub Player',
    getOAuthToken,
    volume
  });

  player.addListener('ready', (event) => onReady?.(event));
  player.addListener('not_ready', (event) => onNotReady?.(event));
  player.addListener('player_state_changed', (state) => onStateChange?.(state));
  player.addListener('initialization_error', (event) => onInitializationError?.(event));
  player.addListener('authentication_error', (event) => onAuthenticationError?.(event));
  player.addListener('account_error', (event) => onAccountError?.(event));
  player.addListener('playback_error', (event) => onPlaybackError?.(event));

  const connected = await player.connect();
  if (!connected) {
    throw new Error('Failed to connect Spotify Web Playback SDK');
  }

  return player;
}

export async function destroySpotifyPlayer(player) {
  if (!player) {
    return;
  }

  try {
    await player.disconnect();
  } catch (error) {
    console.warn('Failed to disconnect Spotify player cleanly:', error);
  }
}