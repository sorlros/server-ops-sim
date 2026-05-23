"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AttemptSnapshot } from "@/application/usecases/types";
import type { ScenarioListItem } from "@/domain/scenario/types";
import type { CommandResult } from "@/domain/observation/types";

interface TranscriptEntry {
  command: string;
  result: CommandResult;
}

export function SimulatorClient({ scenarios }: { scenarios: ScenarioListItem[] }) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id ?? "disk-full");
  const [snapshot, setSnapshot] = useState<AttemptSnapshot | null>(null);
  const [command, setCommand] = useState("help");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const selected = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0],
    [scenarios, selectedScenarioId]
  );

  async function startScenario() {
    setIsBusy(true);
    setHint(null);
    setTranscript([]);
    const response = await fetch(`/api/scenarios/${selectedScenarioId}/start`, { method: "POST" });
    const data = (await response.json()) as AttemptSnapshot;
    setSnapshot(data);
    setCommand("help");
    setIsBusy(false);
  }

  async function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !command.trim()) return;
    setIsBusy(true);
    const response = await fetch(`/api/attempts/${snapshot.attempt.id}/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command })
    });
    const data = (await response.json()) as AttemptSnapshot;
    setSnapshot(data);
    if (data.attempt.lastCommand) {
      setTranscript((items) => [...items, { command, result: data.attempt.lastCommand! }]);
    }
    setCommand("");
    setIsBusy(false);
  }

  async function requestHint() {
    if (!snapshot) return;
    setIsBusy(true);
    const response = await fetch(`/api/attempts/${snapshot.attempt.id}/hint`, { method: "POST" });
    const data = (await response.json()) as AttemptSnapshot & { hint?: string };
    setSnapshot(data);
    setHint(data.hint ?? null);
    setIsBusy(false);
  }

  return (
    <main className="workspace">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">MVP Scenarios</p>
          <h1>ServerOps Simulator</h1>
        </div>
        <div className="scenarioList">
          {scenarios.map((scenario) => (
            <button
              className={scenario.id === selectedScenarioId ? "scenarioCard active" : "scenarioCard"}
              key={scenario.id}
              onClick={() => {
                setSelectedScenarioId(scenario.id);
                setSnapshot(null);
                setTranscript([]);
                setHint(null);
              }}
            >
              <span>{scenario.title}</span>
              <small>{scenario.difficulty}</small>
              <p>{scenario.synopsis}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="mainPanel">
        <div className="incidentHeader">
          <div>
            <p className="eyebrow">Incident Brief</p>
            <h2>{selected?.title}</h2>
            <p>{selected?.initialAlert}</p>
          </div>
          <button className="primaryButton" disabled={isBusy} onClick={startScenario}>
            {snapshot ? "시나리오 재시작" : "시나리오 시작"}
          </button>
        </div>

        <div className="grid">
          <section className="panel terminalPanel">
            <div className="panelHeader">
              <h3>Web Terminal</h3>
              <span>{snapshot ? `attempt ${snapshot.attempt.id.slice(0, 8)}` : "not started"}</span>
            </div>
            <div className="terminalOutput">
              {!snapshot && <p className="muted">시나리오를 시작하면 명령어를 입력할 수 있습니다.</p>}
              {transcript.map((entry, index) => (
                <div className="terminalBlock" key={`${entry.command}-${index}`}>
                  <div className="prompt">$ {entry.command}</div>
                  {entry.result.stdout && <pre>{entry.result.stdout}</pre>}
                  {entry.result.stderr && <pre className="stderr">{entry.result.stderr}</pre>}
                  {entry.result.effects.length > 0 && <p className="effects">effects: {entry.result.effects.join(", ")}</p>}
                </div>
              ))}
            </div>
            <form className="commandForm" onSubmit={submitCommand}>
              <span>$</span>
              <input
                value={command}
                disabled={!snapshot || isBusy}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="df -h"
              />
              <button disabled={!snapshot || isBusy}>실행</button>
            </form>
          </section>

          <section className="panel statusPanel">
            <div className="panelHeader">
              <h3>상태 / 평가</h3>
              <span className={snapshot?.attempt.state.incidentResolved ? "badge ok" : "badge"}>
                {snapshot?.attempt.state.incidentResolved ? "resolved" : "open"}
              </span>
            </div>
            {snapshot ? (
              <>
                <div className="metrics">
                  <Metric label="CPU" value={`${snapshot.attempt.state.cpu.utilizationPercent}%`} />
                  <Metric label="Memory" value={`${snapshot.attempt.state.memory.usedMb}/${snapshot.attempt.state.memory.totalMb}MB`} />
                  <Metric label="DB Conn" value={`${snapshot.attempt.state.database.activeConnections}/${snapshot.attempt.state.database.maxConnections}`} />
                  <Metric label="Score" value={`${snapshot.evaluation.score} (${snapshot.evaluation.grade})`} />
                </div>
                <h4>Alerts</h4>
                <ul className="compactList">
                  {snapshot.attempt.state.alerts.map((alert, index) => (
                    <li key={index} className={alert.severity}>{alert.message}</li>
                  ))}
                </ul>
                <h4>Services</h4>
                <ul className="compactList">
                  {snapshot.attempt.state.services.map((service) => (
                    <li key={service.name}>
                      <strong>{service.name}</strong> · {service.status} · {service.message}
                    </li>
                  ))}
                </ul>
                <h4>Postmortem Preview</h4>
                <p className="summary">{snapshot.evaluation.summary}</p>
                <button className="secondaryButton" disabled={isBusy} onClick={requestHint}>
                  힌트 보기 (-8점)
                </button>
                {hint && <p className="hint">{hint}</p>}
              </>
            ) : (
              <p className="muted">시작 전입니다. 왼쪽에서 시나리오를 선택하고 시작하세요.</p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
