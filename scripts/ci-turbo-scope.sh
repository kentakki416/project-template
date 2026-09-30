#!/usr/bin/env bash
# =============================================================================
# scripts/ci-turbo-scope.sh
# =============================================================================
# CI で turbo タスクを「影響範囲だけ」実行する。判定は 3 通り:
#
#   1. base が無い (main への push / 手動実行)      -> 全パッケージ
#   2. パッケージに属さないファイルが変わった        -> 全パッケージ
#   3. それ以外 (通常の PR)                        -> 変更 + それに依存するもの
#
# 2 が必要な理由: turbo の `--filter=...[ref]` は **パッケージに属さないファイルの
# 変更で 0 件を返す**。workflow / turbo.json / lockfile / docker-compose / infra を
# 変えたときにタスクが 1 件も走らないまま緑になるため、全実行に倒す。
#
# Usage:
#   CI_BASE_SHA=<sha> scripts/ci-turbo-scope.sh <turbo-task> [追加のグローバルパス正規表現...]
#
# Examples:
#   CI_BASE_SHA=$SHA scripts/ci-turbo-scope.sh test:ci 'docker-compose\.yaml' 'infra/'
#   CI_BASE_SHA=$SHA scripts/ci-turbo-scope.sh lint
#
# Environment:
#   CI_BASE_SHA       比較対象の base commit。空なら全パッケージ実行
#   CI_SCOPE_DRY_RUN  1 なら turbo を実行せず、実行するコマンドを表示する（検証用）
# =============================================================================
set -euo pipefail

TASK="${1:-}"
if [ -z "$TASK" ]; then
  echo "usage: $0 <turbo-task> [extra-global-path-regex...]" >&2
  exit 2
fi
shift

BASE="${CI_BASE_SHA:-}"

# どのタスクでも影響範囲を特定できないパス。呼び出し側が追加分を渡す。
GLOBAL_PATHS='\.github/|turbo\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml'
for extra in "$@"; do
  GLOBAL_PATHS="${GLOBAL_PATHS}|${extra}"
done
GLOBAL_PATHS="^(${GLOBAL_PATHS})"

run_turbo() {
  if [ "${CI_SCOPE_DRY_RUN:-}" = "1" ]; then
    echo "  [dry-run] pnpm turbo run $*"
    return 0
  fi
  pnpm turbo run "$@"
}

if [ -z "$BASE" ]; then
  echo "::notice::base の指定が無いため全パッケージで ${TASK} を実行する"
  run_turbo "$TASK"
  exit 0
fi

# `git diff | grep -q` にしないこと。grep -q はマッチ時点で終了するため、差分が
# 大きいと git diff が SIGPIPE で 141 を返し、pipefail によって条件全体が偽になる。
# **マッチしているのに影響範囲のみに倒れる**（ファイル 2 万件で再現確認済み）。
# パイプを挟まずファイル経由で grep する。
CHANGED="$(mktemp)"
trap 'rm -f "$CHANGED"' EXIT
git diff --name-only "${BASE}...HEAD" > "$CHANGED"

echo "変更ファイル ($(wc -l < "$CHANGED" | tr -d ' ') 件):"
cat "$CHANGED"

if grep -qE "$GLOBAL_PATHS" "$CHANGED"; then
  echo "::notice::パッケージ外の変更を検出したため全パッケージで ${TASK} を実行する"
  run_turbo "$TASK"
else
  echo "::notice::影響範囲のみ ${TASK} を実行する (base=${BASE})"
  run_turbo "$TASK" --filter="...[${BASE}]"
fi
