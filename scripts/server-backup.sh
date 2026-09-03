#!/usr/bin/env bash
# 服务器端脚本，由 GitHub Actions 在 rsync 之前通过 ssh 'bash -s' 管道执行：
# 备份运行时数据（SQLite 数据库 + 上传文件），并只保留最近 10 份备份。
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/chunlong-blog}"
BACKUP_DIR="${BACKUP_DIR:-/opt/chunlong-backups}"
KEEP="${KEEP:-10}"

cd "$APP_DIR"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

backup_items=()
if [[ -d data ]]; then
  backup_items+=(data)
fi
if [[ -d public/uploads ]]; then
  backup_items+=(public/uploads)
fi

if (( ${#backup_items[@]} > 0 )); then
  backup_path="$BACKUP_DIR/chunlong-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
  tar -czf "$backup_path" "${backup_items[@]}"
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
