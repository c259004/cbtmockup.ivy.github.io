// ===========================
//  0) 画面切り替え
// ===========================

//アプリ内で使用する画面IDの一覧
const screens = ["loginScreen", "examScreen", "answerSituation", "finishScreen"];

/**
 * 指定した画面IDの画面だけを表示して、他の画面は非表示にする
 * @param {string} screenId - 表示したい画面のID（表示対象を切り替えるため）
 */
function hyoujiGamen(screenId) {
  // すべての画面を走査して、表示状態を切り替える
  screens.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("screen--active", id === screenId);

    // 画面切替後にヘッダー/フッター実寸を取り直す
  requestAnimationFrame(syncBarsHeight);

  });

  // 解答状況に画面に入った時だけ、残り時間表示を同期する
  if (screenId === "answerSituation") {
    ensureRemainInSituation();
    updateRemain();
  }
}

// ===========================
//  1) アプリ状態（現状は1問だけ）
// ===========================
let currentQuestionIndex = 0;                // 0〜19
const isAnswered = Array(20).fill(false);    // 回答済みフラグ
const isReview   = Array(20).fill(false);    // 見直しフラグ
const situationButtons = [];                 // 解答状況画面のボタン（DOM要素）を格納

// ===========================
//  2) ログイン → 試験画面へ切り替え
// ===========================
const loginStartButton = document.getElementById("loginStartButton");
// ボタンが押された場合のみ、画面切り替えを実行
loginStartButton?.addEventListener("click", () => {
  resetExam();
  hyoujiGamen("examScreen");
  startTimer();
});


// ===========================
// ex) ヘッダー実寸をCSS変数に同期
// ===========================
function syncHeaderHeight() {
  const header = document.querySelector("#examScreen .header");
  if (!header) return;

  const h = header.getBoundingClientRect().height;
  document.documentElement.style.setProperty("--header-real", `${h}px`);
}

function syncBarsHeight() {
  syncHeaderHeight();
  syncFooterHeight();
}

function syncFooterHeight() {
  const footer = document.querySelector("#examScreen .footer");
  if (!footer) return;
  const h = footer.getBoundingClientRect().height;
  document.documentElement.style.setProperty("--footer-real", `${h}px`);
}

// 初回と、画面サイズ変化時に同期
syncFooterHeight();
window.addEventListener("resize", syncFooterHeight);


// 初回
syncBarsHeight();

// resize時
window.addEventListener("resize", () => {
  requestAnimationFrame(syncBarsHeight);
});


const mq = window.matchMedia("(max-width: 600px)");
mq.addEventListener("change", () => {
  requestAnimationFrame(syncBarsHeight);
});


// ===========================
//  3) ズーム（左の問題文だけ）
// ===========================

// ズーム用のスライダー（％）と表示用テキストを取得する
const zoomRange = document.getElementById("zoomRange");
const zoomValue = document.getElementById("zoomValue");

/**
 * ズーム率（%）を
 * 画面表示（100%など）に反映させて
 * CSS変数 --q-base(px) として設定する
 * 
 * ※文字サイズ16pxを100%とする仕様を維持
 */
function applyZoom(percent) {

  // 表示用テキストを更新（存在する場合のみ）
  if (zoomValue) zoomValue.textContent = `${percent}%`;

  // % → pxに変換（16pxが基準）
  const px = (16 * percent) / 100;

  // CSS変数 --q-base を js から書き換え
  document.documentElement.style.setProperty("--q-base", `${px}px`);

  syncHeaderHeight();
}

// スライダーが存在する場合のみ処理を有効化
if (zoomRange) {

  // 初期表示時：現在のスライダー値を反映
  applyZoom(Number(zoomRange.value));
  
  // スライダー操作に応じてリアルタイムでズーム更新
  zoomRange.addEventListener("input", () => {
    applyZoom(Number(zoomRange.value));
  });
}

// ===========================
//  4) 幅調整（ドラッグバー）
// ===========================

// レイアウト、ドラッグバー、アプリルート要素を取得
const layout  = document.querySelector(".layout");
const dragBar = document.querySelector(".drag-bar");
const appRoot = document.querySelector(".app");

// 「今ドラッグ中かどうか」を表すフラグ isDragging を用意
let isDragging = false;

// バーを押した瞬間、ドラッグ状態に入る
if (layout && dragBar) {
  dragBar.addEventListener("mousedown", (e) => {
    isDragging = true;
    appRoot?.classList.add("is-resizing");
    e.preventDefault();
  });

  // ドラッグ終了処理（マウスを離した/画面外にでたとき）
  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    appRoot?.classList.remove("is-resizing");
  };

  // マウス操作が途切れる場面でドラッグを終了させる
  window.addEventListener("mouseup", stopDrag);
  window.addEventListener("blur", stopDrag); // 別タブに行ったとき
  window.addEventListener("mouseleave", stopDrag);

  // ドラッグ中のみ、マウス移動に応じて幅を更新
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    e.preventDefault();

    // レイアウト全体の幅と、左カラムの新しい幅を計算
    const rect = layout.getBoundingClientRect();
    const totalWidth = rect.width;

    let leftWidth = e.clientX - rect.left;

    // 右カラムは全体の1/3以上にならない / 右の最小幅は220px
    const minLeft = totalWidth * (2 / 3);
    const maxLeft = totalWidth - 220;

    if (leftWidth < minLeft) leftWidth = minLeft;
    if (leftWidth > maxLeft) leftWidth = maxLeft;

    // CSS grid の列幅を直接書き換えて反映
    layout.style.gridTemplateColumns = `${leftWidth}px 6px 1fr`;
  });
}

// ===========================
//  5) テーマ切り替え（白黒反転）
// ===========================

// テーマ切り替え用トグル（複数画面分）と、アプリ全体を取得
const themeToggles = document.querySelectorAll(".themeToggle");
const root = document.querySelector(".app");

// 現在のテーマ（背景）がダークかどうかを判定
function isDarkTheme() {
  return root?.getAttribute("data-theme") === "dark";
}

// すべてのトグルを、現在のテーマ状態に同期させる
function syncThemeToggles() {
  themeToggles.forEach((t) => {
    t.checked = isDarkTheme();
  });
}

// トグル操作時：テーマを切り替えて、他のトグルも更新
themeToggles.forEach((t) => {
  t.addEventListener("change", () => {
    const toDark = t.checked;
    root?.setAttribute("data-theme", toDark ? "dark" : "light");
    syncThemeToggles();
  });
});

// 初期表示時にトグル状態を揃える
syncThemeToggles();

// ===========================
//  6) タイマー（5分・複数表示対応）
// ===========================

// 残り時間（秒）とタイマー状態を管理
let sec = 300;
let timerId = null;
let isExamFinished = false;

// 残り時間を画面上のすべての表示に反映する
function updateRemain() {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, "0");
  const text = `${m}:${s}`;

  // その時点で存在する .remainText を全部更新
  document.querySelectorAll(".remainText").forEach((el) => {
    el.textContent = text;
  });

  // スマホ用：header__left の data-remain を更新
  document.querySelectorAll(".header__left").forEach((hl) => {
    hl.setAttribute("data-remain", `残り ${text}`);
  });
}

// タイマー開始
function startTimer() {
  if (timerId !== null) return;

  updateRemain();

  timerId = setInterval(() => {
    if (isExamFinished) {
      clearInterval(timerId);
      timerId = null;
      return;
    }

    if (sec <= 0) {
      sec = 0;
      updateRemain();

      clearInterval(timerId);
      timerId = null;

      // 元仕様：時間切れは確認なしで強制終了
      handleFinishExam({ skipConfirm: true, reason: "timeout" });
      return;
    }

    // 1秒ごとにカウントダウン
    sec--;
    updateRemain();
  }, 1000);
}

//startTimer();

function resetExam() {
  // タイマー完全リセット
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  sec = 300;
  isExamFinished = false;

  // 状態リセット（1問だけ運用でも、20問配列は初期化してOK）
  currentQuestionIndex = 0;
  isAnswered.fill(false);
  isReview.fill(false);

  // 選択肢の見た目リセット（残ってると「選択済み」のままになる）
  document.querySelectorAll(".choice-btn").forEach((b) => {
    b.classList.remove("is-selected", "selected");
  });

  // 「後で見直す」UIも整合取る（ボタン＆チェック）
  setReviewState(false);

  // 解答状況の色・チェックを初期状態に戻す
  updateSituationButtons();

  // 表示を初期値へ
  updateRemain();
}

// ===========================
//  7) 選択肢（ラジオ風）
// ===========================
const choiceButtons = document.querySelectorAll(".choice-btn");

choiceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    choiceButtons.forEach((b) => b.classList.remove("is-selected"));
    btn.classList.add("is-selected");

    // 元コードのまま残す（どこかで参照してても壊さない）
    window.currentAnswer = btn.textContent.trim();

    isAnswered[currentQuestionIndex] = true;
    updateSituationButtons();
  });
});

/**
 * ※ selected クラスは現在の主要ロジックでは使用していないが、
 * 旧コードや未確認の参照が存在する可能性があるため残している。
 * 見た目・挙動に影響はないが、安全のため削除していない。
 */
const choices = document.querySelectorAll(".choice-btn");
choices.forEach((btn) => {
  btn.addEventListener("click", () => {
    choices.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
  });
});

// ===========================
//  8) 参考資料モーダル（共通）
// ===========================

// 各画面にある「参考資料」ボタンをすべて取得
const refButtons  = document.querySelectorAll(".refButton");

// モーダル本体、閉じるボタン、背景要素
const refModal    = document.getElementById("refModal");
const refClose    = document.getElementById("refModalClose");
const refBackdrop = refModal?.querySelector(".modal__backdrop");

// モーダルを表示する
function openRefModal() {
  if (!refModal) return;
  refModal.classList.add("modal--open");
  refModal.setAttribute("aria-hidden", "false");
}

// モーダルを非表示にする
function closeRefModal() {
  if (!refModal) return;
  refModal.classList.remove("modal--open");
  refModal.setAttribute("aria-hidden", "true");
}

// 参考資料ボタンをクリックでモーダルを開く
refButtons.forEach((btn) => btn.addEventListener("click", openRefModal));

// ×ボタンもしくは背景クリックでモーダルを閉じる
refClose?.addEventListener("click", closeRefModal);
refBackdrop?.addEventListener("click", closeRefModal);

// Escキーでも閉じられる仕様に
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeRefModal();
});

// ===========================
//  9) 解答状況：画面遷移
// ===========================

// 「解答状況」ボタンをクリックで、解答状況画面を表示
document.getElementById("situationButton")?.addEventListener("click", () => {
  hyoujiGamen("answerSituation");
});

// 「問題に戻る」ボタンをクリックで、問題画面を再表示する
document.getElementById("backToExamButton")?.addEventListener("click", () => {
  hyoujiGamen("examScreen");
});

// ===========================
// 10) 解答状況ボタン生成（1〜20）
// ===========================

// 解答状況画面のボタンを作成して表示（初期化）
function makeSituationButtons() {
  const grid = document.querySelector(".situation-grid");
  if (!grid) return;

  // 画面上と配列の両方をリセットして作り直す
  grid.innerHTML = "";
  situationButtons.length = 0;

  for (let i = 1; i <= 20; i++) {
    const btn = document.createElement("button");
    btn.classList.add("sit-btn");
    btn.textContent = i;

    /**
     * 現状1問だけなので、1番だけ押せる仕様（他は無効化）
     * 今後は　押した番号のページに飛ぶように改良を予定している
     */
    if (i === 1) {
      btn.addEventListener("click", () => {
        currentQuestionIndex = 0;
        hyoujiGamen("examScreen");
      });
    } else {
      btn.disabled = true;
      btn.classList.add("sit-btn--disabled");
    }

    grid.appendChild(btn);

    // あとで状態を更新できるように、配列にも保存しておく
    situationButtons.push(btn);
  }

  // 作成直後に、回答済み/見直し状態を反映
  updateSituationButtons();
}

  // ページ読み込み時に1度だけ実行（初期表示）
  makeSituationButtons();

// ボタンの状態を isAnswered / isReview に合わせて更新する
function updateSituationButtons() {
  situationButtons.forEach((btn, index) => {

    // まず状態をリセット
    btn.classList.remove("sit-btn--answered");

    const oldCheck = btn.querySelector(".sit-btn__check");
    if (oldCheck) oldCheck.remove();

    // 回答済みなら見た目を変更する
    if (isAnswered[index]) {
      btn.classList.add("sit-btn--answered");
    }

    // あとで見直す場合は ✓ をつける（回答済み＆見直す場合も付ける）
    if (isReview[index]) {
      const check = document.createElement("span");
      check.classList.add("sit-btn__check");
      check.textContent = "✓";
      btn.appendChild(check);
    }
  });
}

// ===========================
// 11) 「後で見直す」状態のON/OFF
// ===========================

// UI部品（フッターのボタン/右上のチェックボックス）
const reviewButton   = document.getElementById("reviewButton");
const reviewCheckbox = document.getElementById("reviewCheckbox");

// 見直しの状態を1か所で更新し、画面の表示もすべて更新する
function setReviewState(isOn) {
  const idx = currentQuestionIndex;

  // 1) 内部状態（データ）を更新
  isReview[idx] = isOn;

  // 2) フッターの「後で見直す」ボタンの見た目を更新
  if (reviewButton) {
    reviewButton.classList.toggle("review-active", isOn);
    reviewButton.classList.toggle("is-marked", isOn);
  }

  // 3) 右上のチェックボックスも同じ状態にそろえる
  if (reviewCheckbox) {
    reviewCheckbox.checked = isOn;
  }

  // 4) 解答状況画面の✓表示も更新
  updateSituationButtons();
}

// フッターボタン：クリックするたびに ON / OFF を反転
reviewButton?.addEventListener("click", () => {
  const idx = currentQuestionIndex;
  setReviewState(!isReview[idx]);
});

// チェックボックス： ON / OFF の変更に追従させる
reviewCheckbox?.addEventListener("change", () => {
  setReviewState(reviewCheckbox.checked);
});

// 初期表示：現在の問題の表示をUIに反映させる
setReviewState(isReview[currentQuestionIndex]);

// ===========================
// 12) 試験終了（ボタンで終了/制限時間切れ 共通）
// ===========================

/**
 * options:
 * - skipConfirm: trueなら確認ダイアログを出さない（時間切れ用）
 * - reason: "manual" / "timeout"（表示や挙動の切り替え用）
 */
function handleFinishExam(options = {}) {
  const { skipConfirm = false, reason = "manual" } = options;

  // 二重終了をガード（連打やタイムアウトの重複を防止）
  if (isExamFinished) return;

  // 手動で終了したときだけ確認
  if (!skipConfirm) {
    const ok = window.confirm(
      "試験を終了して結果を表示します。よろしいですか？\n（終了後は解答の変更はできません）"
    );
    if (!ok) return;
  }

  // 終了判定：以降の操作を無効化＆タイマー停止
  isExamFinished = true;
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }

  // 時間切れだけ通知
  if (reason === "timeout") {
    alert("試験時間が終了しました。解答を終了します。");
  }

  // 終了画面へ
  hyoujiGamen("finishScreen");
}

// 問題 / 解答状況画面それぞれに終了ボタンはあるが、両方から同じ関数を呼ぶ

document.getElementById("finishExam")?.addEventListener("click", () => {
  handleFinishExam();
});

document.getElementById("finishExamFromStatus")?.addEventListener("click", () => {
  handleFinishExam();
});

// ===========================
// 13) トップへ戻る（終了画面）
// ===========================

// 終了画面の「トップに戻る」ボタンを押してログイン画面へ戻す
document.getElementById("backToTop")?.addEventListener("click", () => {
  hyoujiGamen("loginScreen");
});

// ===========================
// 14) 解答状況画面：残り時間の追加（現仕様維持）
// ===========================

/**
 * 解答状況画面に「残り時間」表示が無い場合のみ、後からDOMを追加する
 * ※ 既存仕様を壊さないため、存在チェックを行っている
 */
function ensureRemainInSituation() {

  // 解答状況画面を取得
  const screen = document.getElementById("answerSituation");
  if (!screen) return;

  // すでに残り時間表示があれば何もしない（二重生成を防止）
  if (screen.querySelector(".remain")) return;

  // 残り時間表示の要素を作成
  const remain = document.createElement("div");
  remain.className = "remain situation-remain";
  remain.innerHTML = `残り <span class="remainText"></span>`;

  // タイトルの直後に挿入
  const title = screen.querySelector(".situation-title");
  if (title) title.after(remain);
}

// 解答状況画面用の残り時間表示を準備し、現在の残り時間を反映
ensureRemainInSituation();
updateRemain();
