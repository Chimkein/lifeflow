import { describe, it, expect } from "vitest";
import { sanitizeTelegramHtml, stripTelegramHtml } from "./telegram";

describe("sanitizeTelegramHtml", () => {
  it("converts <ul>/<li> to bullets and keeps supported tags", () => {
    const input = "<b>Today</b>\n<ul>\n<li><b>Top</b>: finish app</li>\n<li>No events</li>\n</ul>";
    const out = sanitizeTelegramHtml(input);
    expect(out).toContain("<b>Today</b>");
    expect(out).toContain("• <b>Top</b>: finish app");
    expect(out).toContain("• No events");
    expect(out).not.toContain("<ul>");
    expect(out).not.toContain("<li>");
  });

  it("strips unsupported tags but keeps <a>, <i>, <code>", () => {
    const input = '<i>hi</i> <a href="https://x.y">link</a> <code>x</code> <div>drop</div><span>drop</span>';
    const out = sanitizeTelegramHtml(input);
    expect(out).toContain("<i>hi</i>");
    expect(out).toContain('<a href="https://x.y">link</a>');
    expect(out).toContain("<code>x</code>");
    expect(out).not.toContain("<div>");
    expect(out).not.toContain("<span>");
  });

  it("drops <script> entirely", () => {
    expect(sanitizeTelegramHtml("a<script>alert(1)</script>b")).toBe("ab");
  });

  it("converts <br> to newlines", () => {
    expect(sanitizeTelegramHtml("a<br>b<br/>c")).toBe("a\nb\nc");
  });
});

describe("stripTelegramHtml", () => {
  it("removes all tags and decodes basic entities", () => {
    const input = "<b>Hi</b>\n<ul><li>a &amp; b</li><li>c &lt;d&gt;</li></ul>";
    expect(stripTelegramHtml(input)).toBe("Hi\n• a & b\n• c <d>");
  });
});
