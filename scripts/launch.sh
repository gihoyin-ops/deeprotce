set -e
set -o pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$script_dir/lib/deepchat.sh"

dc_init_runtime
port="$(dc_port)"
dc_access_panel "$port"

if dc_port_busy "$port"; then
  pid="$(dc_port_pid "$port")"
  if [ -n "$pid" ]; then
    dc_line "  Port $port is already running by PID $pid." yellow
  else
    dc_line "  Port $port is already running." yellow
  fi
  dc_line "  O  Open current server" cyan
  dc_line "  R  Restart server" green
  dc_line "  P  Use another port" yellow
  dc_line "  Q  Quit" gray
  printf "  Choose: "
  read -r choice
  case "$choice" in
    O|o)
      dc_open_browser "$(dc_local_url "$port")"
      exit 0
      ;;
    P|p)
      printf "  Port: "
      read -r next_port
      printf "%s" "$next_port" | grep -Eq '^[0-9]+$' || {
        dc_line "  Port must be a number." red
        exit 1
      }
      port="$next_port"
      export DEEPCHAT_PORT="$port"
      dc_access_panel "$port"
      ;;
    R|r)
      dc_stop_port_owner "$port"
      ;;
    *)
      exit 0
      ;;
  esac
  if dc_port_busy "$port"; then
    dc_line "  Port $port is still busy." red
    exit 1
  fi
fi

if ! dc_deps_ready; then
  dc_pnpm_install
fi

dc_ensure_build 1

dc_line "  Starting DeepChat..." green
dc_line ""
dc_start_server "$port"
