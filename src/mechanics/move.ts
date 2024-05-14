import { Node as KdlNode } from "kdljs";
import { App, Component, MarkdownRenderer } from "obsidian";

export default async function renderMove(
  app: App,
  el: HTMLElement,
  node: KdlNode,
  sourcePath: string,
  parent: Component,
) {
  const moveName = node.values[0] as string;
  const moveNode = el.createEl("details", { cls: "forged-move" });
  const summary = moveNode.createEl("summary");
  await renderMarkdown(summary, moveName);
  let lastRoll = undefined;
  for (const item of node.children) {
    const name = item.name.toLowerCase();
    switch (name) {
      case "-": {
        await renderDetail(moveNode, item, renderMarkdown);
        break;
      }
      case "add": {
        renderAdd(moveNode, item);
        break;
      }
      case "roll": {
        lastRoll = item;
        renderRoll(moveNode, item);
        break;
      }
      case "progress-roll": {
        lastRoll = item;
        renderProgress(moveNode, item);
        break;
      }
      case "die-roll": {
        // TODO: actually style these.
        renderDieRoll(moveNode, item);
        break;
      }
      case "reroll": {
        if (lastRoll) {
          renderReroll(moveNode, item, lastRoll);
        }
        break;
      }
      case "meter": {
        renderMeter(moveNode, item);
        break;
      }
      case "burn": {
        // TODO
        break;
      }
      case "clock": {
        // TODO
        break;
      }
      case "progress": {
        // TODO
        break;
      }
      case "oracle": {
        // TODO
        break;
      }
      default: {
        renderUnknown(moveNode, name);
      }
    }
  }
  async function renderMarkdown(el: HTMLElement, md: string) {
    await MarkdownRenderer.render(app, md, el, sourcePath, parent);
  }
}

// --- Renderers ---

async function renderDetail(
  moveNode: HTMLElement,
  item: KdlNode,
  renderMarkdown: (el: HTMLElement, md: string) => Promise<void>,
) {
  const detailNode = moveNode.createEl("p", {
    cls: "detail",
  });
  await renderMarkdown(
    detailNode,
    (item.values[0] as string).replaceAll(/^/g, "> "),
  );
}

function renderAdd(moveNode: HTMLElement, add: KdlNode) {
  // TODO: probably turn this into a dlist, too?
  moveNode.createEl("p", {
    cls: "add",
    text: `Add +${add.values[0]}${add.values[1] ? " (" + add.values[1] + ")" : ""}`,
  });
}

function renderMeter(moveNode: HTMLElement, meter: KdlNode) {
  const name = meter.values[0] as string;
  const from = meter.properties.from as number;
  const to = meter.properties.to as number;
  const delta = to - from;
  const neg = delta < 0;
  renderDlist(moveNode, "meter", {
    Meter: { cls: "meter-name", value: name },
    Delta: {
      cls: "delta" + " " + (neg ? "negative" : "positive"),
      value: Math.abs(delta),
    },
    From: { cls: "from", value: from },
    To: { cls: "to", value: to },
  });
}

function renderRoll(moveNode: HTMLElement, roll: KdlNode) {
  const action = roll.properties["action"] as number;
  const statName = roll.values[0] as string;
  const stat = roll.properties.stat as number;
  const adds = (roll.properties.adds as number) ?? 0;
  const score = Math.min(10, action + stat + adds);
  const challenge1 = roll.properties["vs1"] as number;
  const challenge2 = roll.properties["vs2"] as number;
  const {
    cls: outcomeClass,
    text: outcome,
    match,
  } = moveOutcome(score, challenge1, challenge2);
  setMoveHit(moveNode, outcomeClass, match);
  renderDlist(moveNode, "roll", {
    "Action Die": { cls: "action-die", value: action },
    Stat: { cls: "stat", value: stat },
    "Stat Name": { cls: "stat-name", value: statName },
    Adds: { cls: "adds", value: adds },
    Score: { cls: "score", value: score },
    "Challenge Die 1": { cls: "challenge-die", value: challenge1 },
    "Challenge Die 2": { cls: "challenge-die", value: challenge2 },
    Outcome: { cls: "outcome", value: outcome, dataProp: false },
  });
}

function renderProgress(moveNode: HTMLElement, roll: KdlNode) {
  const score = roll.properties.score as number;
  const challenge1 = roll.properties["vs1"] as number;
  const challenge2 = roll.properties["vs2"] as number;
  const {
    cls: outcomeClass,
    text: outcome,
    match,
  } = moveOutcome(score, challenge1, challenge2);
  setMoveHit(moveNode, outcomeClass, match);
  renderDlist(moveNode, "roll progress", {
    "Progress Score": { cls: "progress-score", value: score },
    "Challenge Die 1": { cls: "challenge-die", value: challenge1 },
    "Challenge Die 2": { cls: "challenge-die", value: challenge2 },
    Outcome: { cls: "outcome", value: outcome, dataProp: false },
  });
}

function renderDieRoll(moveNode: HTMLElement, roll: KdlNode) {
  const reason = roll.values[0] as string;
  const value = roll.values[1] as number;
  renderDlist(moveNode, "die-roll", {
    [reason]: { cls: "die", value },
  });
}

function renderReroll(moveNode: HTMLElement, roll: KdlNode, lastRoll: KdlNode) {
  const action = lastRoll.properties.action as number | undefined;
  const newScore = Math.min(
    ((roll.properties.action ?? action) as number) +
      (lastRoll.properties.stat as number) +
      ((lastRoll.properties.adds as number) ?? 0),
    10,
  );
  const lastVs1 = lastRoll.properties.vs1 as number;
  const lastVs2 = lastRoll.properties.vs2 as number;
  const newVs1 = (roll.properties.vs1 ?? lastRoll.properties.vs1) as number;
  const newVs2 = (roll.properties.vs2 ?? lastRoll.properties.vs2) as number;
  const {
    cls: outcomeClass,
    text: outcome,
    match,
  } = moveOutcome(newScore, newVs1, newVs2);
  const def: DataList = {};
  if (roll.properties.action != null) {
    const newAction = roll.properties.action as number;
    lastRoll.properties.action = newAction;
    def["Old Action Die"] = { cls: "action-die", value: action ?? 0 };
    def["New Action Die"] = { cls: "action-die", value: newAction };
  }
  if (roll.properties.vs1 != null) {
    const newVs1 = roll.properties.vs1 as number;
    lastRoll.properties.vs1 = newVs1;
    def["Old Challenge Die 1"] = { cls: "challenge-die", value: lastVs1 };
    def["New Challenge Die 1"] = { cls: "challenge-die", value: newVs1 };
  }
  if (roll.properties.vs2 != null) {
    const newVs2 = roll.properties.vs2 as number;
    lastRoll.properties.vs2 = newVs2;
    def["Old Challenge Die 2"] = { cls: "challenge-die", value: lastVs2 };
    def["New Challenge Die 2"] = { cls: "challenge-die", value: newVs2 };
  }
  def["New Score"] = { cls: "score", value: newScore };
  def["Outcome"] = { cls: "outcome", value: outcome, dataProp: false };
  setMoveHit(moveNode, outcomeClass, match);
  renderDlist(moveNode, "reroll", def);
}

function renderUnknown(moveNode: HTMLElement, name: string) {
  moveNode.createEl("p", {
    text: `Unknown move node: "${name}"`,
    cls: "error",
  });
}

// --- Util ---

type DataList = Record<string, DataDef>;

interface DataDef {
  cls: string;
  value: string | number | boolean | null;
  dataProp?: boolean;
}

function renderDlist(el: HTMLElement, cls: string, data: DataList) {
  const dl = el.createEl("dl", { cls });
  for (const [key, { cls, value, dataProp }] of Object.entries(data)) {
    dl.createEl("dt", {
      text: key,
    });
    const dd = dl.createEl("dd", {
      cls,
      text: "" + value,
    });
    if (dataProp !== false) {
      dd.setAttribute("data-value", "" + value);
    }
  }
  return dl;
}

function setMoveHit(moveEl: HTMLElement, hitKind: string, match: boolean) {
  switch (hitKind.split(" ")[0]) {
    case "strong-hit": {
      moveEl.classList.toggle("strong-hit", true);
      moveEl.classList.toggle("weak-hit", false);
      moveEl.classList.toggle("miss", false);
      break;
    }
    case "weak-hit": {
      moveEl.classList.toggle("strong-hit", false);
      moveEl.classList.toggle("weak-hit", true);
      moveEl.classList.toggle("miss", false);
      break;
    }
    case "miss": {
      moveEl.classList.toggle("strong-hit", false);
      moveEl.classList.toggle("weak-hit", false);
      moveEl.classList.toggle("miss", true);
      break;
    }
  }
  moveEl.classList.toggle("match", match);
}

function moveOutcome(
  score: number,
  challenge1: number,
  challenge2: number,
): { cls: string; text: string; match: boolean } {
  let outcomeClass;
  let outcome;
  if (score > challenge1 && score > challenge2) {
    outcomeClass = "strong-hit";
    outcome = "Strong Hit";
  } else if (score > challenge1 || score > challenge2) {
    outcomeClass = "weak-hit";
    outcome = "Weak Hit";
  } else {
    outcomeClass = "miss";
    outcome = "Miss";
  }
  if (challenge1 === challenge2) {
    outcomeClass += " match";
    outcome += " (Match)";
  }
  return {
    cls: outcomeClass,
    text: outcome,
    match: challenge1 === challenge2,
  };
}
