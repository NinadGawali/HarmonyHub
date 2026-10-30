import pytest
from pydantic import ValidationError

from app.schemas import LlmPlaylist, RecommendRequest


def test_count_is_clamped_and_text_is_cleaned():
    request = RecommendRequest(prompt="  late   night  drive ", artist=" The Weeknd ", count=99, market="gb")
    assert request.prompt == "late night drive"
    assert request.artist == "The Weeknd"
    assert request.count == 15
    assert request.market == "GB"
    assert RecommendRequest(prompt="x", count="nope").count == 10
    assert RecommendRequest(prompt="x", count=1).count == 4
    assert RecommendRequest(prompt="x", market="Europe").market is None


def test_blank_prompt_is_rejected():
    with pytest.raises(ValidationError):
        RecommendRequest(prompt="    ")


def test_golden_llm_reply_parses():
    raw = (
        '{"assistant_message": "A smooth late-night set.", "songs": ['
        '{"title": "Blinding Lights", "artist": "The Weeknd", "reason": "Driving synths."},'
        '{"title": "Midnight City", "artist": "M83", "reason": "Neon, nocturnal."}]}'
    )
    playlist = LlmPlaylist.model_validate_json(raw)
    assert playlist.assistant_message == "A smooth late-night set."
    assert [song.artist for song in playlist.songs] == ["The Weeknd", "M83"]
