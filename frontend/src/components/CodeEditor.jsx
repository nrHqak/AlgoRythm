import { useState } from "react";

const LINE_HEIGHT = 24;

export function CodeEditor({
  code,
  arrayVar,
  errorLine,
  isLoading,
  onCodeChange,
  onArrayVarChange,
  onRun,
  examples,
  selectedExample,
  onExampleChange,
  task,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const lineNumbers = Array.from({ length: Math.max(code.split("\n").length, 1) }, (_, index) => index + 1);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Code Workspace</h2>
          <p>Run student code, inspect every step, and experiment with alternate algorithms.</p>
        </div>
        <button className="primary-button" type="button" onClick={onRun} disabled={isLoading}>
          {isLoading ? "Running..." : "Run"}
        </button>
      </div>

      {task ? (
        <div className="task-banner">
          <div className="task-row">
            <strong>{task.title}</strong>
            <span className={`difficulty-badge ${task.difficulty}`}>{task.difficulty}</span>
          </div>
          <div className="helper-text">{task.description}</div>
        </div>
      ) : null}

      <div className="toolbar-row">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="array-var">Array variable name</label>
          <input
            id="array-var"
            type="text"
            value={arrayVar}
            onChange={(event) => onArrayVarChange(event.target.value)}
            placeholder="arr"
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="example-select">Load example</label>
          <select id="example-select" value={selectedExample} onChange={(event) => onExampleChange(event.target.value)}>
            {examples.map((example) => (
              <option key={example.key} value={example.key}>
                {example.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="editor-shell">
        <div className="editor-lines" style={{ transform: `translateY(-${scrollTop}px)` }}>
          {lineNumbers.map((lineNumber) => (
            <div
              key={lineNumber}
              className={`editor-line-number${errorLine === lineNumber ? " is-error" : ""}`}
              style={{ height: `${LINE_HEIGHT}px` }}
            >
              {lineNumber}
            </div>
          ))}
        </div>

        <div className="editor-surface">
          {errorLine ? (
            <div
              className="editor-error-highlight"
              style={{
                top: `${(errorLine - 1) * LINE_HEIGHT - scrollTop}px`,
                height: `${LINE_HEIGHT}px`,
              }}
            />
          ) : null}
          <textarea
            className="code-textarea"
            spellCheck="false"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            onScroll={(event) => setScrollTop(event.target.scrollTop)}
          />
        </div>
      </div>
    </section>
  );
}
