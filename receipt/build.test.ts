import { test, expect } from "bun:test";
import { buildReceipt, scrub, assertClean } from "./build";
import fixture from "./fixtures/sample-room.json";
test("wire message identities, elapsed time, approval owner, and links", () => {
 const html=buildReceipt(fixture);
 expect(html).toContain("<strong>1</strong>human messages");
 expect(html).toContain("<strong>1</strong>agent messages");
 expect(html).toContain("40.0 seconds"); expect(html).toContain("user:sample-owner");
 expect(html).toContain("<strong>1</strong>accepted tool approvals");
 expect(html).toContain('href="https://example.test/review"');
 expect(html).not.toContain('href="javascript:'); expect(html).not.toContain("<script>");
 expect(html).toContain("&lt;script&gt;"); expect(html).toContain("outcome unverified");
});
test("deduplicates events and does not trust sender_kind or display names", () => {
 const event=structuredClone(fixture.events[0]); (event as any).data.payload.sender="unverified";
 (event as any).data.payload.sender_kind="human";
 const html=buildReceipt([event,event]);
 expect(html).toContain("<strong>0</strong>human messages"); expect(html).toContain("<strong>1</strong>unknown messages");
});
test("declined approval is attributed but not counted as accepted", () => {
 const event=structuredClone(fixture.events[2]); (event as any).native_approval_room_record.answer="2";
 expect(buildReceipt([event])).toContain("<strong>0</strong>accepted tool approvals");
 expect(buildReceipt([event])).toContain("decline");
});
test("recursive secret scrubbing and residual fail-closed gate", () => {
 const sample = "sk-" + "SAMPLEFICTIONALVALUE123456";
 const jwt = ["eyJzYW1wbGUiOiJub3QtcmVhbCJ9","c2FtcGxl","c2lnbmF0dXJl"].join(".");
 const result=JSON.stringify(scrub({api_key:"invented",nested:[sample,jwt,"password=fictional", "Bearer invented", "https://sample:invented@example.test/", "https://example.test/?token=fictional"]}));
 expect(result).not.toContain(sample); expect(result).not.toContain(jwt); expect(result).not.toContain("invented"); expect(result).not.toContain("fictional");
 expect(() => assertClean(result)).not.toThrow();
 expect(() => assertClean(sample)).toThrow("receipt refused");
});
test("rejects malformed exports",()=>expect(()=>buildReceipt({})).toThrow());
