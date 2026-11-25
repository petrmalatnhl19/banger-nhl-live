"""Carry the article's own confirmation separately from collection clocks."""
from urllib.parse import urlsplit


def article_metadata(item):
    text = item.get("confirmationEvidence")
    source = item.get("source")
    if not isinstance(source, str):
        return {}
    url = urlsplit(source)
    if (item.get("status") == "confirmed"
            and item.get("confirmationBasis") == "explicit_pregame_report"
            and isinstance(text, str) and text.strip()
            and item.get("sourcePublishedAt") and item.get("goalieId")
            and url.scheme == "https" and url.hostname in ("www.rotowire.com", "rotowire.com")
            and url.path.startswith("/hockey/headlines/")):
        return {"article_text": text, "article_published_at": item["sourcePublishedAt"],
                "article_goalie_id": str(item["goalieId"])}
    return {}
