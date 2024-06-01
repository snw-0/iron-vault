import { Move, MoveCategory } from "@datasworn/core/dist/Datasworn";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";

import IronVaultPlugin from "index";
import { MoveModal } from "moves/move-modal";
import { md } from "utils/ui/directives";

export default async function renderIronVaultMoves(
  cont: HTMLElement,
  plugin: IronVaultPlugin,
) {
  const loading = cont.createEl("p", { text: "Loading data..." });
  await plugin.datastore.waitForReady;
  loading.remove();
  litHtmlMoveList(cont, plugin, plugin.datastore.moveCategories.values());
}

function litHtmlMoveList(
  cont: HTMLElement,
  plugin: IronVaultPlugin,
  moveCategories: Iterable<MoveCategory>,
  open: boolean = false,
) {
  const tpl = html`
    <input
      class="search-box"
      type="search"
      placeholder="Filter moves..."
      @input=${(e: Event) => {
        const input = e.target as HTMLInputElement;
        const query = input.value.toLowerCase();
        const categories = plugin.datastore.moveCategories.values();
        const [newList, total] = [...categories].reduce(
          (acc, cat) => {
            const contents = Object.values(cat.contents ?? {});
            const filtered = contents.filter(
              (m) =>
                m.name.toLowerCase().includes(query) ||
                m.trigger.text.toLowerCase().includes(query),
            );
            if (filtered.length) {
              acc[0].push({
                ...cat,
                contents: Object.fromEntries(filtered.map((m) => [m._id, m])),
              });
              acc[1] += filtered.length;
            }
            return acc;
          },
          [[], 0] as [MoveCategory[], number],
        );
        litHtmlMoveList(cont, plugin, newList, total < 5);
      }}
    />
    <ol class="iron-vault-moves-list">
      ${map(moveCategories, (cat) => renderCategory(plugin, cat, open))}
    </ol>
  `;
  render(tpl, cont);
}

function renderCategory(
  plugin: IronVaultPlugin,
  category: MoveCategory,
  open: boolean,
) {
  return html`
  <li class="category" style=${category.color ? `border-left: 6px solid ${category.color}` : ""}>
    <div class="wrapper">
      <details ?open=${open}>
        <summary><span>${category.canonical_name ?? category.name}</span></summary>
      </details>
      <ol class="content">
        ${map(Object.values(category.contents ?? {}), (move) => html`${renderMove(plugin, move)}`)}
      </ol>
  </li>`;
}

function renderMove(plugin: IronVaultPlugin, move: Move) {
  return html`
    <li
      @click=${(ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        new MoveModal(plugin.app, plugin, move).open();
      }}
    >
      <header>${move.name}</header>
      ${md(plugin, move.trigger.text)}
    </li>
  `;
}
