import unittest

from scripts.core43_article_provenance import article_metadata


class ArticleProvenanceTest(unittest.TestCase):
    def test_only_explicit_article_fields_supply_publication(self):
        report = dict(status="confirmed", confirmationBasis="explicit_pregame_report",
                      confirmationEvidence="Tarasov will start.", goalieId="8480193",
                      source="https://www.rotowire.com/hockey/headlines/report-600965",
                      sourcePublishedAt="2026-11-24T18:11:36Z", updatedAt="2026-11-25T03:46:25Z")
        self.assertEqual(article_metadata(report)["article_published_at"], report["sourcePublishedAt"])
        for field in ("confirmationBasis", "confirmationEvidence", "goalieId", "sourcePublishedAt"):
            self.assertEqual(article_metadata({**report, field: None}), {})
        self.assertEqual(article_metadata({**report, "status": "projected"}), {})
        self.assertEqual(article_metadata({**report, "source": "https://www.rotowire.com/hockey/starting-goalies.php"}), {})
