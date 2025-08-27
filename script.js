require.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs",
  },
});

require(["vs/editor/editor.main"], function () {
  const editor = monaco.editor.create(document.getElementById("editor"), {
    value: ``,
    language: "html",
    theme: "vs-dark",
    wordWrap: "on",
    fontSize: 14,
  });

  let currentHighlight = [];
  let updateTimeout;

  // -----------------------------
  // Update iframe live preview
  // -----------------------------
  function updateOutput() {
    const outputFrame = document.getElementById("output-frame");
    const htmlContent = editor.getValue();
    const outputDoc =
      outputFrame.contentDocument || outputFrame.contentWindow.document;

    outputDoc.open();
    outputDoc.write(htmlContent);
    outputDoc.close();

    attachIframeClickListener();
    runHTMLValidation(); // validate after each update
  }

  // -----------------------------
  // Debounced live update
  // -----------------------------
  editor.onDidChangeModelContent(function () {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      updateOutput();
    }, 300);
  });

  // -----------------------------
  // Highlight range in editor
  // -----------------------------
  function highlightRange(startIndex, endIndex) {
    const model = editor.getModel();
    const startPos = model.getPositionAt(startIndex);
    const endPos = model.getPositionAt(endIndex);

    editor.deltaDecorations(currentHighlight, []);
    currentHighlight = editor.deltaDecorations(
      [],
      [
        {
          range: new monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          ),
          options: { isWholeLine: false, className: "line-highlight" },
        },
      ]
    );

    editor.revealRange(
      new monaco.Range(
        startPos.lineNumber,
        startPos.column,
        endPos.lineNumber,
        endPos.column
      ),
      monaco.editor.ScrollType.Smooth
    );
  }

  // -----------------------------
  // Click & selection sync
  // -----------------------------
  function attachIframeClickListener() {
    const outputFrame = document.getElementById("output-frame");
    const outputDoc =
      outputFrame.contentDocument || outputFrame.contentWindow.document;
    if (!outputDoc.body) return;

    outputDoc.body.onclick = null;
    outputDoc.body.onmouseup = null;

    function getTextNode(el) {
      if (!el) return null;
      if (el.nodeType === Node.TEXT_NODE && el.textContent.trim()) return el;
      if (el.nodeType === Node.ELEMENT_NODE && el.textContent.trim())
        return el.firstChild || el;
      return getTextNode(el.parentNode);
    }

    outputDoc.body.addEventListener("click", (e) => {
      const node = getTextNode(e.target);
      if (!node) return;

      const text =
        node.nodeType === Node.TEXT_NODE ? node.textContent : node.textContent;
      const editorContent = editor.getValue();
      const index = editorContent.indexOf(text.trim());
      if (index !== -1) highlightRange(index, index + text.trim().length);
    });

    outputDoc.body.addEventListener("mouseup", (e) => {
      const selection = outputDoc.getSelection();
      if (!selection || selection.isCollapsed) return;

      const selectedText = selection.toString().trim();
      const editorContent = editor.getValue();
      const startIndex = editorContent.indexOf(selectedText);

      if (startIndex !== -1) {
        highlightRange(startIndex, startIndex + selectedText.length);
      }
    });
  }

  // -----------------------------
  // HTMLHint full-tag validation
  // -----------------------------
  function runHTMLValidation() {
    const model = editor.getModel();
    const value = model.getValue();
    if (!window.HTMLHint) return;

    const messages = HTMLHint.verify(value, {});
    const markers = [];

    messages.forEach((msg) => {
      const lines = value.split("\n");
      const lineIndex = Math.max(0, msg.line - 1);
      let startOffset = 0;
      let endOffset = value.length;

      // heuristic: highlight from first '<' on line to next '>' (whole tag)
      const lineText = lines[lineIndex] || "";
      const openTagPos = lineText.indexOf("<");
      const closeTagPos = lineText.indexOf(">", openTagPos);
      if (openTagPos !== -1 && closeTagPos !== -1) {
        const lineStartOffset = lines
          .slice(0, lineIndex)
          .map((l) => l.length + 1)
          .reduce((a, b) => a + b, 0);
        startOffset = lineStartOffset + openTagPos;
        endOffset = lineStartOffset + closeTagPos + 1;
      } else {
        // fallback: highlight entire line
        const lineStartOffset = lines
          .slice(0, lineIndex)
          .map((l) => l.length + 1)
          .reduce((a, b) => a + b, 0);
        startOffset = lineStartOffset;
        endOffset = lineStartOffset + lineText.length;
      }

      const startPos = model.getPositionAt(startOffset);
      const endPos = model.getPositionAt(endOffset);

      markers.push({
        startLineNumber: startPos.lineNumber,
        startColumn: startPos.column,
        endLineNumber: endPos.lineNumber,
        endColumn: endPos.column,
        message: msg.message,
        severity: monaco.MarkerSeverity.Error,
      });
    });

    monaco.editor.setModelMarkers(model, "html-validation", markers);
  }

  // -----------------------------
  // Upload HTML
  // -----------------------------
  const uploadBtn = document.getElementById("upload-btn");
  uploadBtn.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith(".html")) {
      const reader = new FileReader();
      reader.onload = function (event) {
        const htmlContent = event.target.result;
        editor.setValue(htmlContent);
        updateOutput();
      };
      reader.readAsText(file);
    } else {
      alert("Please upload a valid HTML file.");
    }
  });

  // -----------------------------
  // Download HTML
  // -----------------------------
  document.getElementById("download-btn").addEventListener("click", () => {
    const blob = new Blob([editor.getValue()], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "index.html";
    a.click();
  });

  // -----------------------------
  // Initial live preview
  // -----------------------------
  updateOutput();

  // -----------------------------
  // Dynamic width 50/50
  // -----------------------------
  function updateWidths() {
    const container = document.getElementById("editor-container");
    const w = container.clientWidth / 2;
    document.getElementById("editor").style.width = `${w}px`;
    document.getElementById("output").style.width = `${w}px`;
    editor.layout();
  }
  window.addEventListener("resize", updateWidths);
  updateWidths();
});
