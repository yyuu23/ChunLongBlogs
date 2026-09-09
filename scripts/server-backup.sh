#!/usr/bin/env bash
# 服务器端脚本：备份运行时数据（SQLite 数据库 + 上传文件），只保留最近 $KEEP 份。
# 触发方：
#   1. GitHub Actions 部署时通过 ssh 'bash -s' 管道执行（见 .github/workflows/deploy.yml）；
#   2. 服务器 crontab 每日定时执行——安装方法见 docs/DEPLOYMENT.md「日常操作速查」。
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/chunlong-blog}"
BACKUP_DIR="${BACKUP_DIR:-/opt/chunlong-backups}"
KEEP="${KEEP:-30}"

cd "$APP_DIR"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# SQLite 一致性快照：WAL 模式下直接 tar 活库，拷贝瞬间若有写入落盘快照会撕裂；
# better-sqlite3 的 .backup() 是 SQLite Online Backup API，库在被使用中也能产出
# 一致副本，且依赖就在应用 node_modules 里，零新增。失败/缺 node 时回退为
# 直接打包 data/（与旧行为一致）。
STAGE=""
if [[ -f data/db.sqlite ]]; then
  STAGE="$(mktemp -d)"
  if command -v node >/dev/null 2>&1 && \
     node -e "require('better-sqlite3')('data/db.sqlite',{readonly:true}).backup(process.argv[1])" "$STAGE/db.sqlite"; then
    mkdir -p "$STAGE/data"
    mv "$STAGE/db.sqlite" "$STAGE/data/db.sqlite"
    echo "Consistent DB snapshot created."
  else
    echo "WARN: DB snapshot failed, falling back to raw data/ copy." >&2
    rm -rf "$STAGE"
    STAGE=""
  fi
fi

backup_path="$BACKUP_DIR/chunlong-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
if [[ -n "$STAGE" ]]; then
  # 快照按 data/db.sqlite 的原路径打包，恢复方式与直接打包 data/ 完全一致
  if [[ -d public/uploads ]]; then
    tar -czf "$backup_path" -C "$STAGE" data -C "$APP_DIR" public/uploads
  else
    tar -czf "$backup_path" -C "$STAGE" data
  fi
  rm -rf "$STAGE"
else
  backup_items=()
  if [[ -d data ]]; then
    backup_items+=(data)
  fi
  if [[ -d public/uploads ]]; then
    backup_items+=(public/uploads)
  fi
  if (( ${#backup_items[@]} > 0 )); then
    tar -czf "$backup_path" "${backup_items[@]}"
  fi
fi

if [[ -f "$backup_path" ]]; then
  chmod 600 "$backup_path"
  echo "Runtime data backed up to $backup_path"
fi

# 只保留最近 $KEEP 份备份，避免无限累积占满磁盘。
# 注意：目录为空时 ls 的通配会返回非零退出码，在 set -e / pipefail 下会中止脚本，
# 因此先用 nullglob 数组统计数量，只有确实超量时才执行清理。
shopt -s nullglob
existing=("$BACKUP_DIR"/chunlong-*.tar.gz)
shopt -u nullglob

if (( ${#existing[@]} > KEEP )); then
  ls -1t "$BACKUP_DIR"/chunlong-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm -f
  echo "Pruned old backups, keeping the most recent $KEEP."
fi
