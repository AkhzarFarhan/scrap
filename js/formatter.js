/**
 * formatter.js
 * Core formatting, C++ syntax highlighting, 3GPP specification markdown parser,
 * ASCII diagram detector, and protocol math engines (SLIV & OLLA).
 */

(function (global) {
  "use strict";

  const CPP_KEYWORDS = new Set([
    "alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor", "bool", "break",
    "case", "catch", "char", "char8_t", "char16_t", "char32_t", "class", "compl", "concept",
    "const", "consteval", "constexpr", "constinit", "const_cast", "continue", "co_await",
    "co_return", "co_yield", "decltype", "default", "delete", "do", "double", "dynamic_cast",
    "else", "enum", "explicit", "export", "extern", "false", "final", "float", "for", "friend",
    "goto", "if", "import", "inline", "int", "long", "module", "mutable", "namespace", "new",
    "noexcept", "not", "not_eq", "nullptr", "operator", "or", "or_eq", "override", "private",
    "protected", "public", "reflexpr", "register", "reinterpret_cast", "requires", "return",
    "short", "signed", "sizeof", "static", "static_assert", "static_cast", "struct", "switch",
    "template", "this", "thread_local", "throw", "true", "try", "typedef", "typeid", "typename",
    "union", "unsigned", "using", "virtual", "void", "volatile", "wchar_t", "while", "xor", "xor_eq"
  ]);

  const CPP_TYPES = new Set([
    "std", "vector", "string", "string_view", "unique_ptr", "shared_ptr", "weak_ptr", "map",
    "unordered_map", "set", "unordered_set", "array", "pair", "tuple", "optional", "variant",
    "any", "span", "cout", "cin", "cerr", "endl", "size_t", "ptrdiff_t", "int8_t", "int16_t",
    "int32_t", "int64_t", "uint8_t", "uint16_t", "uint32_t", "uint64_t", "move", "forward",
    "make_unique", "make_shared", "begin", "end", "initializer_list", "atomic", "mutex",
    "lock_guard", "unique_lock", "shared_lock", " shared_mutex", "thread", "jthread", "future",
    "promise", "async", "condition_variable", "memory_order", "memory_order_relaxed",
    "memory_order_acquire", "memory_order_release", "memory_order_acq_rel", "memory_order_seq_cst",
    "deque", "list", "forward_list", "priority_queue", "stack", "queue", "bitset", "function",
    "expected", "mdspan", "views", "ranges", "coroutine_handle", "suspend_always", "suspend_never"
  ]);

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Syntax-highlights C/C++ code into semantic HTML spans with line numbers.
   */
  function highlightCppCode(rawCode, includeLineNumbers = true) {
    if (!rawCode) return "";
    const code = String(rawCode).replace(/\r\n/g, "\n").trim();

    const tokenRegex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("([^"\\]|\\.)*"|'([^'\\]|\\.)*')|(^\s*#[a-zA-Z_][a-zA-Z0-9_]*)|(\b(?:0x[0-9a-fA-F]+|0b[01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFlLuU]*)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*\b)|([{}])|([()\[\]])|([+\-*/%=&|^!<>?:~]+)|([\s\S])/gm;

    let highlighted = "";
    let match;
    while ((match = tokenRegex.exec(code)) !== null) {
      const val = match[0];
      if (match[1]) {
        highlighted += `<span class="tok-cmt">${escapeHtml(val)}</span>`;
      } else if (match[2]) {
        highlighted += `<span class="tok-str">${escapeHtml(val)}</span>`;
      } else if (match[5]) {
        highlighted += `<span class="tok-pre">${escapeHtml(val)}</span>`;
      } else if (match[6]) {
        highlighted += `<span class="tok-num">${escapeHtml(val)}</span>`;
      } else if (match[7]) {
        if (CPP_KEYWORDS.has(val)) {
          highlighted += `<span class="tok-kw">${escapeHtml(val)}</span>`;
        } else if (CPP_TYPES.has(val)) {
          highlighted += `<span class="tok-type">${escapeHtml(val)}</span>`;
        } else {
          highlighted += escapeHtml(val);
        }
      } else if (match[8]) {
        highlighted += `<span class="tok-brace">${escapeHtml(val)}</span>`;
      } else if (match[9]) {
        highlighted += `<span class="tok-punct">${escapeHtml(val)}</span>`;
      } else if (match[10]) {
        highlighted += `<span class="tok-op">${escapeHtml(val)}</span>`;
      } else {
        highlighted += escapeHtml(val);
      }
    }

    if (!includeLineNumbers) {
      return highlighted;
    }

    const lines = highlighted.split("\n");
    return lines
      .map(
        (lineHtml, idx) =>
          `<div class="code-line"><span class="code-ln">${idx + 1}</span><span class="code-lc">${lineHtml || " "}</span></div>`
      )
      .join("");
  }

  /**
   * Formats inline markdown (**bold**, `code`, **`bold code`**, *italic*) safely.
   */
  function renderInlineMarkdown(text) {
    if (!text) return "";
    let t = String(text);

    // Normalize triple+ asterisks
    t = t.replace(/\*{3,}/g, "**");

    // Protect inline code spans first so C++ pointer types like `int**` or `T&&` are untouched
    const codeSpans = [];
    t = t.replace(/`\*\*([^*`]+)\*\*`|\*\*`([^*`]+)`\*\*|\*\*`([^*`]+)\*\*`|`\*\*([^*`]+)`\*\*/g, (_, g1, g2, g3, g4) => {
      const content = g1 || g2 || g3 || g4;
      const idx = codeSpans.length;
      codeSpans.push(`<code class="inline-code inline-code-bold">${escapeHtml(content)}</code>`);
      return `\u0000CODE_${idx}\u0000`;
    });

    t = t.replace(/`([^`\n]+)`/g, (_, g1) => {
      const idx = codeSpans.length;
      codeSpans.push(`<code class="inline-code">${escapeHtml(g1)}</code>`);
      return `\u0000CODE_${idx}\u0000`;
    });

    // Escape HTML in remaining prose
    t = escapeHtml(t);

    // Bold spans
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Clean any stray unmatched **
    t = t.replace(/\*\*/g, "");

    // Italic spans (*text* where * is not surrounded by spaces)
    t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)']|$)/g, "$1<em>$2</em>");

    // Restore protected code spans
    t = t.replace(/\u0000CODE_(\d+)\u0000/g, (_, idx) => codeSpans[Number(idx)]);

    return t;
  }

  /**
   * Splits explanation text into semantic blocks (main sections vs analogy callouts),
   * matching parseExplanationBlocks in ProductivityComponents.kt.
   */
  function parseExplanationBlocks(explanation) {
    if (!explanation) return [];
    const lines = String(explanation).replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let currentType = "main";
    let currentTitle = "";
    let currentLines = [];

    for (const line of lines) {
      const stripped = line.trim();
      if (
        stripped.startsWith("### Unforgettable Analogy") ||
        stripped.startsWith("### Analogy") ||
        stripped.startsWith("### Deep Dive")
      ) {
        if (currentLines.length > 0) {
          blocks.push({
            type: currentType,
            title: currentTitle,
            content: currentLines.join("\n").trim()
          });
          currentLines = [];
        }
        currentType = "analogy";
        currentTitle = stripped.replace(/^###\s*/, "").trim() || "Architectural Mental Model & Analogy";
        continue;
      }

      if (stripped.startsWith("### ") && currentType === "analogy") {
        if (currentLines.length > 0) {
          blocks.push({
            type: currentType,
            title: currentTitle,
            content: currentLines.join("\n").trim()
          });
          currentLines = [];
        }
        currentType = "section";
        currentTitle = "";
        currentLines.push(stripped);
        continue;
      }

      currentLines.push(line);
    }

    if (currentLines.length > 0) {
      const joined = currentLines.join("\n").trim();
      if (joined) {
        blocks.push({
          type: currentType,
          title: currentTitle,
          content: joined
        });
      }
    }

    return blocks;
  }

  /**
   * Detects if a paragraph is an ASCII diagram or table.
   */
  function isAsciiDiagramParagraph(para) {
    const lines = para.split("\n");
    if (lines.length < 2) return false;
    const boxChars = /[┌┐└┘├┤┬┴┼─│╔╗╚╝╠╣╦╩╬═║]|(\+---)|(-->)|(<==)|(===>)|(\|---)/;
    const matchCount = lines.filter((l) => boxChars.test(l)).length;
    return matchCount >= 2;
  }

  function isMarkdownTableParagraph(para) {
    const lines = para.trim().split("\n");
    if (lines.length < 2) return false;
    return (
      lines[0].trim().startsWith("|") &&
      lines[1].trim().startsWith("|") &&
      lines[1].includes("---")
    );
  }

  function renderMarkdownTable(para) {
    const lines = para
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|"));
    if (lines.length < 2) return `<p>${renderInlineMarkdown(para)}</p>`;

    const parseRow = (rowStr) =>
      rowStr
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());

    const headers = parseRow(lines[0]);
    const bodyRows = lines.slice(2).map(parseRow);

    return `
      <div class="table-wrap">
        <table class="spec-table">
          <thead>
            <tr>${headers.map((h) => `<th>${renderInlineMarkdown(h)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${bodyRows
              .map(
                (r) =>
                  `<tr>${r.map((c) => `<td>${renderInlineMarkdown(c)}</td>`).join("")}</tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Renders a block of formatted prose (paragraphs, headers, bullet lists, numbered lists, tables, diagrams).
   */
  function renderFormattedContentBlock(text) {
    if (!text) return "";
    const paragraphs = String(text).replace(/\r\n/g, "\n").split(/\n\n+/);
    const out = [];
    const numberedRegex = /^\d+\.\s+/;

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      if (isMarkdownTableParagraph(trimmedPara)) {
        out.push(renderMarkdownTable(trimmedPara));
        continue;
      }

      if (isAsciiDiagramParagraph(trimmedPara)) {
        out.push(`<pre class="ascii-diagram">${escapeHtml(trimmedPara)}</pre>`);
        continue;
      }

      const lines = trimmedPara.split("\n");
      const hasBullets = lines.some((l) => {
        const t = l.trim();
        return t.startsWith("- ") || t.startsWith("* ") || t.startsWith("• ");
      });
      const hasNumbered = lines.some((l) => numberedRegex.test(l.trim()));

      if (hasBullets || hasNumbered) {
        let listBuffer = [];
        let listType = null; // 'ul' or 'ol'

        const flushList = () => {
          if (listBuffer.length > 0 && listType) {
            out.push(`<${listType} class="prose-list">${listBuffer.join("")}</${listType}>`);
            listBuffer = [];
            listType = null;
          }
        };

        for (const line of lines) {
          const tLine = line.trim();
          if (!tLine) continue;

          if (tLine.startsWith("#### ") || tLine.startsWith("### ")) {
            flushList();
            const hText = tLine.replace(/^#{3,4}\s+/, "").trim();
            out.push(`<h4 class="prose-subhead">${renderInlineMarkdown(hText)}</h4>`);
          } else if (tLine.startsWith("- ") || tLine.startsWith("* ") || tLine.startsWith("• ")) {
            if (listType !== "ul") {
              flushList();
              listType = "ul";
            }
            const itemContent = tLine.replace(/^[-*•]\s+/, "").trim();
            listBuffer.push(`<li>${renderInlineMarkdown(itemContent)}</li>`);
          } else if (numberedRegex.test(tLine)) {
            if (listType !== "ol") {
              flushList();
              listType = "ol";
            }
            const itemContent = tLine.replace(numberedRegex, "").trim();
            listBuffer.push(`<li>${renderInlineMarkdown(itemContent)}</li>`);
          } else {
            flushList();
            out.push(`<p class="prose-p">${renderInlineMarkdown(tLine)}</p>`);
          }
        }
        flushList();
      } else if (trimmedPara.startsWith("#### ") || trimmedPara.startsWith("### ")) {
        const firstLineEnd = trimmedPara.indexOf("\n");
        if (firstLineEnd === -1) {
          const hText = trimmedPara.replace(/^#{3,4}\s+/, "").trim();
          out.push(`<h4 class="prose-subhead">${renderInlineMarkdown(hText)}</h4>`);
        } else {
          const hText = trimmedPara.slice(0, firstLineEnd).replace(/^#{3,4}\s+/, "").trim();
          const rest = trimmedPara.slice(firstLineEnd + 1).trim();
          out.push(`<h4 class="prose-subhead">${renderInlineMarkdown(hText)}</h4>`);
          if (rest) {
            out.push(renderFormattedContentBlock(rest));
          }
        }
      } else {
        // Multi-line regular paragraph: preserve intentional linebreaks if lines look like equations or key-values
        if (lines.length > 1 && lines.every((l) => l.trim().length < 95)) {
          out.push(
            `<p class="prose-p">${lines.map((l) => renderInlineMarkdown(l.trim())).join("<br>")}</p>`
          );
        } else {
          out.push(`<p class="prose-p">${renderInlineMarkdown(trimmedPara.replace(/\n/g, " "))}</p>`);
        }
      }
    }

    return out.join("\n");
  }

  /**
   * Renders a full RichExplanationView (with separated Analogy Callouts).
   */
  function renderRichExplanation(explanation) {
    const blocks = parseExplanationBlocks(explanation);
    return blocks
      .map((b) => {
        if (b.type === "analogy") {
          return `
            <aside class="callout-box callout-analogy">
              <div class="callout-header">
                <span class="callout-icon">💡</span>
                <span class="callout-title">${escapeHtml(b.title || "Unforgettable Analogy & Mental Model")}</span>
              </div>
              <div class="callout-body">
                ${renderFormattedContentBlock(b.content)}
              </div>
            </aside>
          `;
        }
        return `<div class="explanation-prose">${renderFormattedContentBlock(b.content)}</div>`;
      })
      .join("\n");
  }

  /**
   * 3GPP TS 38.214 §5.1.2.1 SLIV Encoder & Decoder
   */
  function encodeSliv(S, L) {
    S = Number(S);
    L = Number(L);
    if (L <= 0 || S < 0 || S + L > 14) return null;
    if (L - 1 <= 7) {
      return 14 * (L - 1) + S;
    } else {
      return 14 * (14 - L + 1) + (14 - 1 - S);
    }
  }

  function decodeSliv(sliv) {
    sliv = Number(sliv);
    if (sliv < 0 || sliv > 127) return null;
    const q = Math.floor(sliv / 14);
    const r = sliv % 14;
    let S, L;
    if (q + r <= 13) {
      L = q + 1;
      S = r;
    } else {
      L = 14 - q + 1;
      S = 14 - 1 - r;
    }
    const valid = L > 0 && S >= 0 && S + L <= 14;
    return { S, L, q, r, valid };
  }

  /**
   * 3GPP TS 38.214 OLLA Step-Size Calculator
   */
  function computeOlla(targetBlerPercent, deltaUpDb) {
    const bler = Number(targetBlerPercent) / 100.0;
    const up = Number(deltaUpDb);
    const down = bler < 1.0 ? up * (bler / (1.0 - bler)) : 0;
    const ackPerNack = bler > 0 ? (1.0 - bler) / bler : 0;
    return {
      blerRatio: bler,
      deltaUp: up,
      deltaDown: down,
      ackPerNack: ackPerNack
    };
  }

  global.HandbookFormatter = {
    escapeHtml,
    highlightCppCode,
    renderInlineMarkdown,
    renderFormattedContentBlock,
    renderRichExplanation,
    encodeSliv,
    decodeSliv,
    computeOlla
  };
})(window);
