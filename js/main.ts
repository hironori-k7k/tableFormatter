"use strict";
interface String {
	insertNewlines(): string;
}
if (String.prototype.insertNewlines === undefined) {
	String.prototype.insertNewlines = function() {
		return this
		.replace(/(<\/\w+>)/g, "$1\n") // 全ての閉じタグの後に改行を入れる
		.replace(/\n$/g, "") // </table>\n となってしまうので最後の改行のみ削除
		.replace("><table", ">\n<table") // tableの前にdiv開きがあれば改行
		.replace("<tbody>", "\n<tbody>\n") // tbodyの前後を改行
		.replace(/<tr(.+?)>/g, "<tr$1>\n"); // trの後ろを改行
	};
}
// 各テーブルごとのタイプ設定用
type Tabletype = {
	tag_div: string | undefined;
	tag_table: string;
	heading_row: undefined | {
		tag_tr: string;
		tag_th_1st: string;
		tag_th_else: string;
	};
	body_row: {
		tag_tr: string;
		tag_td_1st: string;
		tag_td_else: string;
	};
};
// テーブルのタイプ設定一覧オブジェクト用
type TabletypeList = {[K: string]: Tabletype};

const FORMAT: TabletypeList = {
	// 汎用表（見出し行あり）
	general: {
		tag_div: undefined,
		tag_table: "top-table",
		heading_row: {
			tag_tr: "table-title",
			tag_th_1st: "item-left double-border",
			tag_th_else: "double-border",
		},
		body_row: {
			tag_tr: "table-item",
			tag_td_1st: "item-left double-border",
			tag_td_else: "double-border",
		}
	},
	// 汎用表（見出し行なし）
	general_no_heading: {
		tag_div: undefined,
		tag_table: "top-table",
		heading_row: undefined,
		body_row: {
			tag_tr: "table-item",
			tag_td_1st: "item-left double-border",
			tag_td_else: "double-border",
		}
	},
	// 中段比較表
	middle: {
		tag_div: "scrollable-table-container",
		tag_table: "scroll-top-table2",
		heading_row: {
			tag_tr: "table-title",
			tag_th_1st: "item-left_scroll double-border_plus_scroll item-left2 double-border_plus2",
			tag_th_else: "double-border_plus",
		},
		body_row: {
			tag_tr: "table-item",
			tag_td_1st: "item-left_scroll double-border_plus_scroll item-left2 double-border_plus2", // middleとbottomの相違点
			tag_td_else: "double-border_plus",
		}
	},
	// 最下部比較表
	bottom: {
		tag_div: "scrollable-table-container",
		tag_table: "scroll-top-table2",
		heading_row: undefined,
		body_row: {
			tag_tr: "table-item",
			tag_td_1st: "item-left_scroll double-border_plus_scroll double-border_plus", // middleとbottomの相違点
			tag_td_else: "double-border_plus",
		}
	}
};

// 要素取得
const elem = {
	source: <HTMLInputElement>document.getElementById("source"), // 入力エリア
	output: <HTMLInputElement>document.getElementById("output"), // 出力エリア
	demo: <HTMLInputElement>document.getElementById("demo"), // デモ表示と演算用エリア
	type: <HTMLInputElement>document.getElementById("type"), // 表のタイプ選択のプルダウンリスト
	add_div: <HTMLInputElement>document.getElementById("add_div"), // divの出力有無のチェックボックス
	run: <HTMLInputElement>document.getElementById("runBtn"), // 実行ボタン
	copy: <HTMLInputElement>document.getElementById("copyBtn"), // コピーボタン
	btns: <HTMLInputElement>document.getElementById("btns"), // ボタン2つが入ったdiv
	readonly: <HTMLInputElement>document.getElementById("releaseReadonlyCheck"), // 編集防止解除のチェック
};

function setClasses(element: Element, classes_str: string): void {
	if (classes_str === "") return;
	const classes: string[] = classes_str.trim().split(" ")
		.map(str => str.trim()).filter(str => str !== "");
	for (const cls of classes) element.classList.add(cls);
}
// class以外の属性を全コピー
// function copyAttributeWithoutClass(element: Element, original_element: Element) {
// 	const attrs = original_element.attributes;
// 	for (let i=0;i<attrs.length;i++) {
// 		const [nam, val]: (string | undefined)[] = [attrs.item(i)?.name, attrs.item(i)?.value];
// 		if (nam === undefined || val === undefined) continue;
// 		if (nam === "class") continue;
// 		element.setAttribute(nam, val);
// 	}
// }
function copyRowAndColSpan(cell: Element, original_cell: Element): void {
	for (const attr of ["rowspan", "colspan"]) {
		if (original_cell.hasAttribute(attr)) {
			cell.setAttribute(attr, original_cell.getAttribute(attr) || "");
		}
	}
}

function generateTable(tabletype: string): Element {
	const original_table = elem.demo.querySelector("table");
	const format: Tabletype = FORMAT[tabletype];
	const [table, tbody] = ["table", "tbody"].map(nam => document.createElement(nam));
	table.appendChild(tbody);
	setClasses(table, format.tag_table);
	// 再外部のHTML要素outerを定義
	const outer = (format.tag_div === undefined || elem.add_div.checked === false) ? table : (() => {
		const div = document.createElement("div");
		setClasses(div, format.tag_div);
		div.appendChild(table);
		return div;
	})();
	const original_tr_list = original_table?.querySelectorAll("tr");
	if (original_tr_list === undefined) return outer;
	// 行ごとの処理を行う
	for (const original_tr of original_tr_list) {
		const original_cell_list = original_tr?.querySelectorAll("th, td");
		const tr = document.createElement("tr");
		let cellType: string;
		if (format.heading_row !== undefined && original_tr === original_tr_list[0]) {
			setClasses(tr, format.heading_row.tag_tr);
			cellType = "th";
		} else {
			setClasses(tr, format.body_row.tag_tr);
			cellType = "td";
		}
		// セル事の処理を行う
		for (const original_cell of original_cell_list) {
			const cell = document.createElement(cellType);
			cell.innerHTML = original_cell.innerHTML;
			copyRowAndColSpan(cell, original_cell);
			let classes: string;
			// 最左セル
			if (original_cell === original_cell_list[0]) {
				classes = (cellType === "th" ? format.heading_row?.tag_th_1st : format.body_row.tag_td_1st) || "";
			} else {
			// 最左セル以外
				classes = (cellType === "th" ? format.heading_row?.tag_th_else : format.body_row.tag_td_else) || "";
			}
			setClasses(cell, classes);
			tr.appendChild(cell);
		}
		tbody.appendChild(tr);
	}
	return outer;
}

elem.run?.addEventListener("click", run);
function run(): void {
	// 入力したHTMLをデモエリアに適用する
	const raw = elem.source?.value;
	elem.demo.innerHTML = raw;
	// demoエリアから変更前のtableを抽出
	const original_table = elem.demo.querySelector("table");
	if (!original_table) {
		window.alert("入力欄の文字列からtable要素を検出できませんでした。");
		return;
	}
	// demoエリアの内容をoriginal_tableのみにする
	elem.demo.innerHTML = original_table.outerHTML;
	// 新しいtableを作成
	const table = generateTable(elem.type.value);
	// 作成したtableのHTMLをdemoエリアに適用する
	elem.demo.innerHTML = table.outerHTML;
	// demoエリアのhtml文字列を取得し、改行も調整
	const html = elem.demo.innerHTML.insertNewlines();
	// 作成したhtml文字列をoutputへ出力
	elem.output.value = html;
}

elem.copy?.addEventListener("click", copy);
function copy(): void {
	if (elem.output.value === '') return;
	navigator.clipboard.writeText(elem.output.value);
	copiedMessage();
	function copiedMessage() {
		elem.copy.innerText = 'Copied!';
		elem.btns.classList.add('copied');
		setTimeout(() => {
			elem.copy.innerText = 'Copy';
			elem.btns.classList.remove('copied');
		}, 1500);
	}
}

elem.readonly.addEventListener("input", () => elem.output.toggleAttribute('readonly'));

// elem.source.value = 
// `<table>
// <tbody>
// 	<tr>
// 		<td>項目</td>
// 		<td>項目</td>
// 		<td>項目</td>
// 	</tr>
// 	<tr>
// 		<td>項目</td>
// 		<td>項目</td>
// 		<td>項目</td>
// 	</tr>
// 	<tr>
// 		<td>項目</td>
// 		<td>項目</td>
// 		<td>項目</td>
// 	</tr>
// </tbody>
// </table>`;

// elem.run.dispatchEvent(new Event("click")); // テスト用