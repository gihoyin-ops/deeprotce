set -e
set -o pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$script_dir/lib/deepchat.sh"

dc_init_runtime
dc_line ""
dc_line "  DeepChat macOS, Linux, and Termux installer" green
dc_rule
dc_assert_node
dc_pnpm_install
dc_ensure_build 0
launcher_path="$DEEPCHAT_ROOT/deepchat"
printf "%s\n" "SCRIPT_DIR=\$(CDPATH= cd -- \"\$(dirname -- \"\$0\")\" && pwd)" "exec bash \"\$SCRIPT_DIR/scripts/launch.sh\" \"\$@\"" > "$launcher_path"
chmod +x "$launcher_path"
dc_rule
dc_line "  Installed successfully." green
dc_line "  Use ./deepchat from the project root to launch." cyan
dc_line "  Devices on the same LAN can open the LAN URL shown by the launcher." cyan
