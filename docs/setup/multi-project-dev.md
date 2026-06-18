# 複数プロジェクトをローカルで並行開発する

このテンプレートをベースにしたプロジェクトを **複数同時に立ち上げたい** ときの手順。

ポートを衝突させずに `pnpm dev` を回せるよう、`direnv` でプロジェクトごとに固有のポート帯を自動切替する構成になっている。

## 目次

- [前提と全体像](#前提と全体像)
- [1. direnv のインストール](#1-direnv-のインストール)
- [2. このプロジェクトを `direnv allow`](#2-このプロジェクトを-direnv-allow)
- [3. 別プロジェクトでポート帯をずらす](#3-別プロジェクトでポート帯をずらす)
- [4. 動作確認](#4-動作確認)
- [仕組み](#仕組み)
- [FAQ](#faq)

## 前提と全体像

| 項目 | デフォルト (このプロジェクト) | 別プロジェクト例 |
|---|---|---|
| `apps/web` | `3000` | `4000` / `5000` |
| `apps/admin` | `3030` | `4030` / `5030` |
| `apps/api` | `8080` | `8180` / `8280` |
| Postgres (docker-compose) | `5432` | `5433` / `5434` |
| Redis (docker-compose) | `6379` | `6380` / `6381` |

ポートは `.envrc` で宣言され、リポジトリにコミットされている。`cd` した瞬間に direnv が読み込み、`pnpm dev` / `docker compose up` の双方が自動で同じポートを参照する。

## 1. direnv のインストール

```bash
brew install direnv
```

シェルに hook を追加（zsh の場合。bash なら `~/.bashrc`）:

```bash
# ~/.zshrc
eval "$(direnv hook zsh)"
```

シェルを開き直す（または `source ~/.zshrc`）。

## 2. このプロジェクトを `direnv allow`

セキュリティのため、direnv は **新しい `.envrc` を見つけても明示的に許可するまでロードしない**。

```bash
cd <project-root>
direnv allow
```

以降、このディレクトリ（および配下）に `cd` するたびに自動で port 変数群がロードされる。`.envrc` の内容が変わると再度 `direnv allow` を求められる。

## 3. 別プロジェクトでポート帯をずらす

このテンプレートを `scripts/copy-template.sh` でコピーした **2 つ目以降のプロジェクト** では、`.envrc` を編集してポートをずらす。

`.envrc.example` に 4000 番台 / 5000 番台への寄せ方の雛形がコメントで入っているので、それを参考に **2 つ目以降のプロジェクトの `.envrc` を書き換える**:

```bash
# project-A/.envrc
export PORT_WEB=4000
export PORT_ADMIN=4030
export PORT_API=8180
export POSTGRES_PORT=5433
export REDIS_PORT=6380
```

`.envrc` を書き換えたら `direnv allow` を再度実行する。

> 💡 「このプロジェクト (project-template) を 3000 番台の基準として固定し、後続を 4000 / 5000 とずらしていく」運用が衝突を最小化する。

## 4. 動作確認

```bash
# このプロジェクトのディレクトリで
cd <project-root>
direnv allow                # 初回 / .envrc 変更時のみ
echo $PORT_WEB              # → 3000

# 別プロジェクトのディレクトリで
cd <other-project-root>
echo $PORT_WEB              # → 4000 (別プロジェクトの .envrc 値)
```

両プロジェクトで `pnpm dev` / `docker compose up` を起動して、ポート衝突なく共存することを確認する。

## 仕組み

- **`.envrc`**: direnv が `cd` 時に自動 source するファイル。`PORT_WEB` / `PORT_ADMIN` / `PORT_API` / `POSTGRES_PORT` / `REDIS_PORT` を export する。**コミット対象**
- **`.envrc.example`**: 別プロジェクトで 4000 / 5000 番台に寄せる際の雛形（コメントのみ）
- **`.envrc.local`**: 個人ローカルのオーバーライド（gitignore 済み）
- **`docker-compose.yaml`**: ホスト側ポートが `${POSTGRES_PORT:-5432}` / `${REDIS_PORT:-6379}` の形で変数参照
- **`apps/{web,admin,api}/package.json`**: `dev` / `start` スクリプトが `${PORT_WEB:-3000}` / `${PORT_ADMIN:-3030}` / `${PORT_API:-8080}` を参照

direnv が env vars を export してくれるため、`pnpm dev` も `docker compose up` も追加引数なしで同じポート帯を使える。

## FAQ

### Q. direnv を入れずにポートを変えたい

`.envrc` をシェルで手動 source するか、`pnpm dev` 実行時に環境変数を渡せば動く:

```bash
PORT_WEB=4000 PORT_ADMIN=4030 PORT_API=8180 \
POSTGRES_PORT=5433 REDIS_PORT=6380 \
pnpm dev
```

ただし毎回手動で渡すのは現実的ではないため direnv を推奨。

### Q. docker-compose の container_name はどうする？

`docker-compose.yaml` の `container_name: project-template-postgres` は **コピー時にプロジェクト名へ書き換える前提**（既存の TODO コメント参照）。`scripts/copy-template.sh` でコピーした際、プロジェクト名置換も同時に行うので別プロジェクト間で container 名が衝突することはない。

### Q. `.env.local` と `.envrc` は何が違う？

| ファイル | 役割 | git |
|---|---|---|
| `.envrc` | direnv が export する **プロジェクト共通の env**（ポート等の「誰でも同じ値」）| コミット |
| `apps/<app>/.env.local` | dotenvx で暗号化された **app ごとの秘密情報**（API キー / DB 接続文字列 等）| コミット（暗号化済み） |
| `.envrc.local` | direnv の **個人オーバーライド** | gitignore |

`.envrc` はあくまでポート等の「プロジェクトの作法」を入れる場所で、秘密情報は引き続き dotenvx の `.env.local` を使う。

### Q. CI ではどう扱う？

CI（GitHub Actions 等）では direnv を使わない。`.envrc` の中身に依存しているのはローカル開発時の `pnpm dev` / `docker compose up` のみで、本番ビルド・テストは `${PORT_*:-デフォルト}` のフォールバックで動く。
