"""CORE 4.3 RotoWire publishing must preserve provenance without inventing it."""
import unittest
from scripts.publish_rotowire_goalies import preserve_explicit_confirmation


class ExplicitConfirmationBasisTests(unittest.TestCase):
    def test_timestamp_alone_does_not_establish_confirmation_basis(self):
        row = {"status": "confirmed", "sourcePublishedAt": "2026-11-10T09:00:00Z"}
        result = preserve_explicit_confirmation(row)
        self.assertNotIn("confirmationBasis", result)
        self.assertEqual(result["sourcePublishedAt"], row["sourcePublishedAt"])

    def test_explicit_basis_is_preserved_for_confirmed_report(self):
        row = {"status": "confirmed", "confirmationBasis": "explicit_pregame_report",
               "sourcePublishedAt": "2026-11-10T09:00:00Z"}
        self.assertEqual(preserve_explicit_confirmation(row)["confirmationBasis"],
                         "explicit_pregame_report")

    def test_projection_cannot_claim_explicit_confirmation(self):
        row = {"status": "projected", "confirmationBasis": "explicit_pregame_report"}
        self.assertNotIn("confirmationBasis", preserve_explicit_confirmation(row))

    def test_input_is_not_mutated(self):
        row = {"status": "confirmed", "confirmationBasis": "unverified"}
        preserve_explicit_confirmation(row)
        self.assertEqual(row["confirmationBasis"], "unverified")


if __name__ == "__main__":
    unittest.main()
