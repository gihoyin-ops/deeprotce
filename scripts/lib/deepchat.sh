set -e
set -o pipefail

deepchat_lib_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEEPCHAT_ROOT="$(cd "$deepchat_lib_dir/../.." && pwd)"
DEEPCHAT_HOST="0.0.0.0"

dc_cd_root() {
  cd "$DEEPCHAT_ROOT"
}

dc_color() {
  if [ -t 1 ]; then
    printf "%s" "$1"
  fi
}

dc_reset() {
  if [ -t 1 ]; then
    printf "\033[0m"
  fi
}

dc_line() {
  text="${1:-}"
  color="${2:-}"
  case "$color" in
    green) dc_color "\033[32m" ;;
    cyan) dc_color "\033[36m" ;;
    yellow) dc_color "\033[33m" ;;
    red) dc_color "\033[31m" ;;
    blue) dc_color "\033[34m" ;;
    magenta) dc_color "\033[35m" ;;
    gray) dc_color "\033[90m" ;;
  esac
  printf "%s\n" "$text"
  dc_reset
}

dc_rule() {
  dc_line "------------------------------------------------------------------------" gray
}

dc_port() {
  printf "%s" "${DEEPCHAT_PORT:-3000}"
}

dc_local_url() {
  printf "http://localhost:%s" "$1"
}

dc_is_termux() {
  [ -n "${TERMUX_VERSION:-}" ] || printf "%s" "${PREFIX:-}" | grep -qi "com.termux"
}

dc_init_runtime() {
  dc_cd_root
  mkdir -p data data/chat data/chat/sharechat data/llm data/llm/api data/temp data/temp/file data/user data/user/memories data/backups data/logs
  export DEEPCHAT_AI_LOG=1
  export DEEPCHAT_LOG_FILE="$DEEPCHAT_ROOT/data/logs/deepchat.log"
}

dc_lan_ip() {
  ip_value=""
  if command -v ip >/dev/null 2>&1; then
    ip_value="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')"
  fi
  if [ -z "$ip_value" ] && command -v ifconfig >/dev/null 2>&1; then
    ip_value="$(ifconfig 2>/dev/null | awk '/inet / && $2 !~ /^127\./ && $2 !~ /^169\.254\./ {print $2; exit}')"
  fi
  if [ -z "$ip_value" ] && command -v hostname >/dev/null 2>&1; then
    ip_value="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [ -z "$ip_value" ]; then
    ip_value="localhost"
  fi
  printf "%s" "$ip_value"
}

dc_port_pid() {
  port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp 2>/dev/null | awk -v port=":$port" '$4 ~ port "$" {match($0,/pid=[0-9]+/); if (RSTART) {print substr($0,RSTART+4,RLENGTH-4); exit}}'
    return
  fi
  printf ""
}

dc_port_busy() {
  port="$1"
  pid="$(dc_port_pid "$port")"
  if [ -n "$pid" ]; then
    return 0
  fi
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
    return $?
  fi
  return 1
}

dc_stop_port_owner() {
  port="$1"
  pid="$(dc_port_pid "$port")"
  if [ -z "$pid" ]; then
    return 0
  fi
  dc_line "  Stopping server on port $port with PID $pid..." yellow
  kill "$pid" 2>/dev/null || true
  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
}

dc_assert_node() {
  if ! command -v node >/dev/null 2>&1; then
    dc_line "Node.js 20.9 or newer is required." red
    return 1
  fi
  node -e 'const v=process.versions.node.split(".").map(Number); if (v[0] < 20 || (v[0] === 20 && v[1] < 9)) process.exit(1)' || {
    dc_line "Node.js 20.9 or newer is required. Current version is $(node --version)." red
    return 1
  }
}

dc_step() {
  label="$1"
  shift
  safe_label="$(printf "%s" "$label" | tr -cs '[:alnum:]' '-' | tr '[:upper:]' '[:lower:]' | sed 's/^-//;s/-$//')"
  [ -n "$safe_label" ] || safe_label="step"
  out_file="$DEEPCHAT_ROOT/data/logs/$safe_label.out.log"
  err_file="$DEEPCHAT_ROOT/data/logs/$safe_label.err.log"
  "$@" >"$out_file" 2>"$err_file" &
  step_pid="$!"
  frames='|/-\'
  index=0
  while kill -0 "$step_pid" 2>/dev/null; do
    frame="$(printf "%s" "$frames" | cut -c $((index % 4 + 1)))"
    printf "\r  %s %s" "$label" "$frame"
    sleep 0.16
    index=$((index + 1))
  done
  if wait "$step_pid"; then
    printf "\r  %s done.                                    \n" "$label"
    return 0
  fi
  dc_line ""
  dc_line "  $label failed. Check data/logs/$safe_label.out.log and data/logs/$safe_label.err.log." red
  return 1
}

dc_deps_ready() {
  [ -x "$DEEPCHAT_ROOT/node_modules/.bin/next" ]
}

dc_pnpm_install() {
  dc_assert_node
  if dc_deps_ready; then
    dc_line "  Dependencies are already installed." gray
    return 0
  fi
  if command -v corepack >/dev/null 2>&1; then
    dc_step "Enabling Corepack..." corepack enable || true
  fi
  if command -v pnpm >/dev/null 2>&1; then
    dc_step "Installing dependencies with pnpm..." pnpm install
  else
    dc_step "Installing dependencies with pnpm 10..." npx pnpm@10 install
  fi
}

dc_build() {
  dc_assert_node
  dc_step "Building production app" npm run build
}

dc_build_ready() {
  [ -f "$DEEPCHAT_ROOT/.next/BUILD_ID" ]
}

dc_build_stale() {
  dc_cd_root
  node -e 'const fs=require("fs"); const path=require("path"); const roots=["src","public","package.json","pnpm-lock.yaml","pnpm-workspace.yaml","next.config.ts","postcss.config.mjs","tsconfig.json"]; const build=".next/BUILD_ID"; if(!fs.existsSync(build)) process.exit(0); let latest=0; const walk=p=>{if(!fs.existsSync(p)) return; const s=fs.statSync(p); if(s.isDirectory()){for(const n of fs.readdirSync(p)) walk(path.join(p,n)); return;} latest=Math.max(latest,s.mtimeMs);}; roots.forEach(walk); process.exit(latest>fs.statSync(build).mtimeMs?0:1);'
}

dc_ensure_build() {
  interactive="${1:-1}"
  if ! dc_build_ready; then
    dc_build
    return
  fi
  if ! dc_build_stale; then
    dc_line "  Production build is ready." gray
    return
  fi
  if [ "$interactive" != "1" ]; then
    dc_line "  Production build already exists. Skipping rebuild." gray
    return
  fi
  dc_line "  Source files changed after the last build." yellow
  dc_line "  S  Start existing production build" green
  dc_line "  B  Rebuild before starting" yellow
  dc_line "  Q  Quit" gray
  printf "  Choose: "
  read -r choice
  case "$choice" in
    B|b) dc_build ;;
    Q|q) exit 0 ;;
    *) dc_line "  Starting existing production build." gray ;;
  esac
}

dc_show_line() {
  line="$1"
  [ -n "$(printf "%s" "$line" | tr -d '[:space:]')" ] || return 1
  plain="$(printf "%s" "$line" | sed -E 's/\x1B\[[0-9;]*m//g')"
  printf "%s" "$line" | grep -Eq '\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b' && return 1
  printf "%s" "$plain" | grep -Eq 'Next\.js|Local:[[:space:]]+http|Network:[[:space:]]+http|Ready in' && return 1
  printf "%s" "$plain" | grep -Eiq '^[[:space:]]*(event|wait|ready|compiled|route|rendered|cache|webpack|turbopack)\b' && return 1
  return 0
}

dc_open_browser() {
  url="$1"
  [ "${DEEPCHAT_NO_BROWSER:-}" = "1" ] && return 0
  dc_is_termux && return 0
  case "$(uname -s)" in
    Darwin) open "$url" >/dev/null 2>&1 || true ;;
    Linux) command -v xdg-open >/dev/null 2>&1 && xdg-open "$url" >/dev/null 2>&1 || true ;;
  esac
}

dc_access_panel() {
  port="$1"
  lan_ip="$(dc_lan_ip)"
  local_url="$(dc_local_url "$port")"
  lan_url="http://$lan_ip:$port"
  clear 2>/dev/null || true
  dc_line ""
  dc_line "   ____                  ____ _           _   " blue
  dc_line "  |  _ \  ___  ___ _ __ / ___| |__   __ _| |_ " blue
  dc_line "  | | | |/ _ \/ _ \ '_ \ |   | '_ \ / _\` | __|" blue
  dc_line "  | |_| |  __/  __/ |_) | |___| | | | (_| | |_ " blue
  dc_line "  |____/ \___|\___| .__/ \____|_| |_|\__,_|\__|" blue
  dc_line "                  |_|                          " blue
  dc_line ""
  dc_line "  Cross-platform LAN launcher" gray
  dc_rule
  dc_line "  Local       $local_url" green
  dc_line "  LAN         $lan_url" cyan
  dc_line "  Phone       Open the LAN URL from the same Wi-Fi network" cyan
  dc_line "  Logs        data/logs/deepchat.log" gray
  dc_line "  Bind        $DEEPCHAT_HOST:$port" gray
  dc_rule
  dc_line "  QR fallback $lan_url" magenta
  dc_rule
}

dc_start_server() {
  port="$1"
  next_cmd="$DEEPCHAT_ROOT/node_modules/.bin/next"
  if [ ! -x "$next_cmd" ]; then
    dc_line "Dependencies are missing. Run bash scripts/install.sh first." red
    return 1
  fi
  local_url="$(dc_local_url "$port")"
  ( sleep 3; dc_open_browser "$local_url" ) &
  "$next_cmd" start -H "$DEEPCHAT_HOST" -p "$port" 2>&1 | while IFS= read -r line; do
    printf "%s\n" "$line" >> "$DEEPCHAT_LOG_FILE"
    if dc_show_line "$line"; then
      if printf "%s" "$line" | grep -q '^\[AI\]'; then
        dc_line "$line" cyan
      elif printf "%s" "$line" | grep -Eiq 'error|failed|invalid|exception'; then
        dc_line "$line" red
      else
        dc_line "$line" gray
      fi
    fi
  done
}
