"""CORE 4.3 starter ingestion must not silently truncate schedule snapshots."""
import io
import json
import unittest
from urllib.parse import parse_qs, urlsplit
from scripts.ingest_core43_starter_feed import fetch_schedule_snapshots


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self
    def __exit__(self, *args):
        self.close()


class SchedulePaginationTests(unittest.TestCase):
    def test_fetches_all_pages(self):
        calls=[]
        def opener(request, timeout):
            q=parse_qs(urlsplit(request.full_url).query)
            offset=int(q["offset"][0])
            calls.append(offset)
            rows=[{"game_id":i} for i in range(5)][offset:offset+2]
            return FakeResponse(json.dumps(rows).encode())
        rows=fetch_schedule_snapshots("https://example.supabase.co","key",
                                      page_size=2,max_rows=10,opener=opener)
        self.assertEqual([r["game_id"] for r in rows],list(range(5)))
        self.assertEqual(calls,[0,2,4])

    def test_rejects_truncated_schedule(self):
        def opener(request, timeout):
            return FakeResponse(json.dumps([{"game_id":1},{"game_id":2}]).encode())
        with self.assertRaisesRegex(RuntimeError,"cap reached"):
            fetch_schedule_snapshots("https://example.supabase.co","key",
                                      page_size=2,max_rows=4,opener=opener)

    def test_rejects_invalid_response(self):
        def opener(request, timeout):
            return FakeResponse(b'{"unexpected":true}')
        with self.assertRaises(ValueError):
            fetch_schedule_snapshots("https://example.supabase.co","key",
                                      page_size=2,max_rows=4,opener=opener)


if __name__ == "__main__":
    unittest.main()
