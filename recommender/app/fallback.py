"""Real songs from Spotify search, used when the AI is unavailable or suggests too few matchable songs."""
import logging
import re
from typing import Optional

from .spotify import SpotifyClient, SpotifyRateLimited, normalize, quote, to_track
from .schemas import RecommendRequest, Track

log = logging.getLogger(__name__)

SEARCH_LIMIT = 10
MAX_KEYWORDS = 4

# Words that describe a request but do not help a Spotify search.
STOPWORDS = set("""
a an and any are as at be best but by for from get give i in into is it its just like make me mix more
my of on or our playlist playlists please some song songs something that the their them these this to
track tracks up very vibe vibes want we with you your feel feeling music listen listening kind type
""".split())


def keywords(prompt: str) -> list[str]:
    words = re.findall(r"[\w'&-]+", prompt.lower())
    picked = []
    for word in words:
        if len(word) > 1 and word not in STOPWORDS and word not in picked:
            picked.append(word)
    return picked[:MAX_KEYWORDS]


def _interleave(lists: list[list[dict]]) -> list[dict]:
    merged = []
    for index in range(max((len(items) for items in lists), default=0)):
        for items in lists:
            if index < len(items):
                merged.append(items[index])
    return merged


async def search_tracks(
    spotify: SpotifyClient,
    request: RecommendRequest,
    count: int,
    exclude: Optional[set[str]] = None,
    seed_artists: Optional[list[str]] = None,
) -> list[Track]:
    """Up to `count` tracks: the preferred artist, then artists the AI already picked, then prompt keywords."""
    exclude = set(exclude or ())
    words = keywords(request.prompt)
    # Artist queries fill the list first; keyword queries only fill what is left.
    queries: list[tuple[str, int, str, str]] = []  # (query, offset, reason, artist the results must include)
    if request.artist:
        queries.append((f'artist:"{quote(request.artist)}"', 0, f"By {request.artist}, your preferred artist.", request.artist))
    # Songs by artists the AI chose fit the prompt far better than a keyword search does.
    for artist in seed_artists or []:
        if normalize(artist) != normalize(request.artist):
            queries.append((f'artist:"{quote(artist)}"', 0, f"More from {artist}, who fits this playlist.", artist))
    if words:
        phrase = " ".join(words)
        queries.append((phrase, 0, f"Spotify search match for “{phrase}”.", ""))
        queries.append((phrase, SEARCH_LIMIT, f"Spotify search match for “{phrase}”.", ""))
        if len(words) > 1:
            queries.append((words[0], 0, f"Spotify search match for “{words[0]}”.", ""))

    artist_results: list[list[dict]] = []
    keyword_results: list[list[dict]] = []
    reasons: dict[str, str] = {}
    for query, offset, reason, artist in queries:
        if not artist and len({i["id"] for r in artist_results for i in r} - exclude) >= count:
            break  # artist searches already found enough songs
        try:
            items = await spotify.search(query, SEARCH_LIMIT, request.market, offset)
        except SpotifyRateLimited:
            break
        except Exception as error:
            log.warning("Fallback search %r failed: %s", query, error)
            continue
        if artist:
            # Spotify's artist: filter is fuzzy ("WYS" also finds "WUYS"), so keep exact artist matches only.
            wanted = normalize(artist)
            items = [i for i in items if any(normalize(a.get("name", "")) == wanted for a in i.get("artists", []))]
        for item in items:
            reasons.setdefault(item["id"], reason)
        (artist_results if artist else keyword_results).append(items)

    tracks: list[Track] = []
    seen_titles: set[tuple[str, str]] = set()
    for item in _interleave(artist_results) + _interleave(keyword_results):
        track = to_track(item, reasons.get(item["id"], ""), "search")
        title_key = (normalize(track.title), normalize(track.artist))
        if track.spotify_id in exclude or title_key in seen_titles:
            continue
        exclude.add(track.spotify_id)
        seen_titles.add(title_key)
        tracks.append(track)
        if len(tracks) >= count:
            break
    return tracks
