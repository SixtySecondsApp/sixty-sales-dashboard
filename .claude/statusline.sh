#!/bin/bash
# Custom Claude Code statusline
# Theme: detailed | Colors: true | Features: directory, git, model, context, usage, session, tokens, burnrate

# ---- configuration ----
LOG_FILE="${HOME}/.claude/statusline.log"
LOG_MAX_LINES=1000
CCUSAGE_CACHE_FILE="${HOME}/.claude/.ccusage_cache"
CCUSAGE_CACHE_TTL=30  # seconds
GIT_UNCOMMITTED_WARN_THRESHOLD=5  # warn if more than this many uncommitted changes

# ---- read input first (critical: must be before any logging) ----
input=$(cat)

# ---- timestamp ----
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ---- log rotation ----
if [ -f "$LOG_FILE" ] && [ "$(wc -l < "$LOG_FILE" 2>/dev/null)" -gt "$LOG_MAX_LINES" ]; then
  tail -n "$((LOG_MAX_LINES / 2))" "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

# ---- logging ----
{
  echo "[$TIMESTAMP] Status line triggered with input:"
  (echo "$input" | jq . 2>/dev/null) || echo "$input"
  echo "---"
} >> "$LOG_FILE" 2>/dev/null

# ---- color helpers (force colors for Claude Code) ----
use_color=1
[ -n "$NO_COLOR" ] && use_color=0

C() { [ "$use_color" -eq 1 ] && printf '\033[%sm' "$1"; }
rst() { [ "$use_color" -eq 1 ] && printf '\033[0m'; }

# ---- consolidated color definitions ----
dir_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;117m'; }      # sky blue
model_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;147m'; }    # light purple
version_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;180m'; }  # soft yellow
cc_version_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;249m'; } # light gray
style_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;245m'; }    # gray
git_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;150m'; }      # soft green
git_warn_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;208m'; } # orange warning
git_danger_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;203m'; } # red danger
usage_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;189m'; }    # lavender
cost_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;222m'; }     # light gold
burn_color() { [ "$use_color" -eq 1 ] && printf '\033[38;5;220m'; }     # bright gold

# Dynamic context color (set based on remaining %)
context_clr='\033[1;37m'  # default white
set_context_color() {
  local pct="$1"
  if [ "$pct" -le 20 ]; then
    context_clr='\033[38;5;203m'  # coral red
  elif [ "$pct" -le 40 ]; then
    context_clr='\033[38;5;215m'  # peach
  else
    context_clr='\033[38;5;158m'  # mint green
  fi
}
context_color() { [ "$use_color" -eq 1 ] && printf "$context_clr"; }

# Dynamic session color (set based on remaining %)
session_clr='\033[38;5;194m'  # default light green
set_session_color() {
  local rem_pct="$1"
  if [ "$rem_pct" -le 10 ]; then
    session_clr='\033[38;5;210m'  # light pink
  elif [ "$rem_pct" -le 25 ]; then
    session_clr='\033[38;5;228m'  # light yellow
  else
    session_clr='\033[38;5;194m'  # light green
  fi
}
session_color() { [ "$use_color" -eq 1 ] && printf "$session_clr"; }

# ---- time helpers ----
to_epoch() {
  local ts="$1"
  if command -v gdate >/dev/null 2>&1; then gdate -d "$ts" +%s 2>/dev/null && return; fi
  date -u -j -f "%Y-%m-%dT%H:%M:%S%z" "${ts/Z/+0000}" +%s 2>/dev/null && return
  python3 - "$ts" <<'PY' 2>/dev/null
import sys, datetime
s=sys.argv[1].replace('Z','+00:00')
print(int(datetime.datetime.fromisoformat(s).timestamp()))
PY
}

fmt_time_hm() {
  local epoch="$1"
  if date -r 0 +%s >/dev/null 2>&1; then date -r "$epoch" +"%H:%M"; else date -d "@$epoch" +"%H:%M"; fi
}

progress_bar() {
  local pct="${1:-0}" width="${2:-10}"
  [[ "$pct" =~ ^[0-9]+$ ]] || pct=0
  ((pct<0)) && pct=0
  ((pct>100)) && pct=100
  local filled=$(( pct * width / 100 ))
  local empty=$(( width - filled ))
  printf '%*s' "$filled" '' | tr ' ' '='
  printf '%*s' "$empty" '' | tr ' ' '-'
}

# ---- parse input once with jq ----
if command -v jq >/dev/null 2>&1; then
  parsed=$(echo "$input" | jq -r '[
    (.workspace.current_dir // .cwd // "unknown"),
    (.model.display_name // "Claude"),
    (.model.version // ""),
    (.session_id // ""),
    (.version // ""),
    (.output_style.name // "")
  ] | @tsv' 2>/dev/null)

  IFS=$'\t' read -r current_dir model_name model_version session_id cc_version output_style <<< "$parsed"
  current_dir=$(echo "$current_dir" | sed "s|^$HOME|~|g")
else
  current_dir="unknown"
  model_name="Claude"
  model_version=""
  session_id=""
  cc_version=""
  output_style=""
fi

# ---- git info with uncommitted warning ----
git_branch=""
git_uncommitted=0
git_uncommitted_warn=""

if git rev-parse --git-dir >/dev/null 2>&1; then
  git_branch=$(git branch --show-current 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)

  # Count uncommitted changes (staged + unstaged + untracked)
  git_staged=$(git diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
  git_unstaged=$(git diff --numstat 2>/dev/null | wc -l | tr -d ' ')
  git_untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
  git_uncommitted=$((git_staged + git_unstaged + git_untracked))

  if [ "$git_uncommitted" -gt "$GIT_UNCOMMITTED_WARN_THRESHOLD" ]; then
    if [ "$git_uncommitted" -gt 20 ]; then
      git_uncommitted_warn="$(git_danger_color)⚠️ ${git_uncommitted} uncommitted$(rst)"
    else
      git_uncommitted_warn="$(git_warn_color)${git_uncommitted} uncommitted$(rst)"
    fi
  fi
fi

# ---- context window calculation ----
context_pct=""
context_remaining_pct=""

get_max_context() {
  local model="$1"
  case "$model" in
    *"Opus"*|*"opus"*|*"Sonnet"*|*"sonnet"*|*"Haiku 3.5"*|*"haiku 3.5"*|*"Haiku 4"*|*"haiku 4"*)
      echo "200000"
      ;;
    *"Claude 3 Haiku"*|*"claude 3 haiku"*)
      echo "100000"
      ;;
    *)
      echo "200000"
      ;;
  esac
}

if [ -n "$session_id" ] && command -v jq >/dev/null 2>&1; then
  MAX_CONTEXT=$(get_max_context "$model_name")

  # Convert current dir to session file path
  project_dir=$(echo "$current_dir" | sed "s|~|$HOME|g" | sed 's|/|-|g' | sed 's|^-||')
  session_file="$HOME/.claude/projects/-${project_dir}/${session_id}.jsonl"

  if [ -f "$session_file" ]; then
    latest_tokens=$(tail -20 "$session_file" | jq -r 'select(.message.usage) | .message.usage | ((.input_tokens // 0) + (.cache_read_input_tokens // 0))' 2>/dev/null | tail -1)

    if [ -n "$latest_tokens" ] && [ "$latest_tokens" -gt 0 ] 2>/dev/null; then
      context_used_pct=$(( latest_tokens * 100 / MAX_CONTEXT ))
      context_remaining_pct=$(( 100 - context_used_pct ))
      set_context_color "$context_remaining_pct"
      context_pct="${context_remaining_pct}%"
    fi
  fi
fi

# ---- ccusage integration with caching ----
session_txt=""
session_pct=0
session_bar=""
cost_usd=""
cost_per_hour=""
tpm=""
tot_tokens=""

get_ccusage_data() {
  local now=$(date +%s)
  local cache_valid=0

  # Check if cache exists and is fresh
  if [ -f "$CCUSAGE_CACHE_FILE" ]; then
    local cache_time=$(head -1 "$CCUSAGE_CACHE_FILE" 2>/dev/null)
    if [ -n "$cache_time" ] && [ $((now - cache_time)) -lt "$CCUSAGE_CACHE_TTL" ]; then
      cache_valid=1
      tail -n +2 "$CCUSAGE_CACHE_FILE"
      return
    fi
  fi

  # Fetch fresh data (prefer local ccusage over npx)
  local blocks_output=""
  if command -v ccusage >/dev/null 2>&1; then
    blocks_output=$(ccusage blocks --json 2>/dev/null)
  else
    blocks_output=$(npx ccusage@latest blocks --json 2>/dev/null)
  fi

  # Cache the result
  if [ -n "$blocks_output" ]; then
    {
      echo "$now"
      echo "$blocks_output"
    } > "$CCUSAGE_CACHE_FILE"
    echo "$blocks_output"
  fi
}

if command -v jq >/dev/null 2>&1; then
  blocks_output=$(get_ccusage_data)

  if [ -n "$blocks_output" ]; then
    active_block=$(echo "$blocks_output" | jq -c '.blocks[] | select(.isActive == true)' 2>/dev/null | head -n1)

    if [ -n "$active_block" ]; then
      # Parse all values at once
      read -r cost_usd cost_per_hour tot_tokens tpm reset_time_str start_time_str <<< $(echo "$active_block" | jq -r '[
        (.costUSD // ""),
        (.burnRate.costPerHour // ""),
        (.totalTokens // ""),
        (.burnRate.tokensPerMinute // ""),
        (.usageLimitResetTime // .endTime // ""),
        (.startTime // "")
      ] | @tsv' 2>/dev/null)

      if [ -n "$reset_time_str" ] && [ -n "$start_time_str" ]; then
        start_sec=$(to_epoch "$start_time_str")
        end_sec=$(to_epoch "$reset_time_str")
        now_sec=$(date +%s)

        total=$(( end_sec - start_sec ))
        (( total<1 )) && total=1
        elapsed=$(( now_sec - start_sec ))
        (( elapsed<0 )) && elapsed=0
        (( elapsed>total )) && elapsed=$total

        session_pct=$(( elapsed * 100 / total ))
        remaining=$(( end_sec - now_sec ))
        (( remaining<0 )) && remaining=0

        rh=$(( remaining / 3600 ))
        rm=$(( (remaining % 3600) / 60 ))
        end_hm=$(fmt_time_hm "$end_sec")

        set_session_color $((100 - session_pct))
        session_txt="$(printf '%dh %dm until reset at %s (%d%%)' "$rh" "$rm" "$end_hm" "$session_pct")"
        session_bar=$(progress_bar "$session_pct" 10)
      fi
    fi
  fi
fi

# ---- log extracted data ----
{
  echo "[$TIMESTAMP] Extracted: dir=${current_dir:-}, model=${model_name:-}, git=${git_branch:-} (${git_uncommitted} uncommitted), context=${context_pct:-}, cost=${cost_usd:-}"
} >> "$LOG_FILE" 2>/dev/null

# ---- render statusline ----
# Line 1: Core info (directory, git, model, version, output style)
printf '📁 %s%s%s' "$(dir_color)" "$current_dir" "$(rst)"

if [ -n "$git_branch" ]; then
  printf '  🌿 %s%s%s' "$(git_color)" "$git_branch" "$(rst)"
  if [ -n "$git_uncommitted_warn" ]; then
    printf ' %s' "$git_uncommitted_warn"
  fi
fi

printf '  🤖 %s%s%s' "$(model_color)" "$model_name" "$(rst)"

if [ -n "$model_version" ] && [ "$model_version" != "null" ]; then
  printf '  🏷️ %s%s%s' "$(version_color)" "$model_version" "$(rst)"
fi

if [ -n "$cc_version" ] && [ "$cc_version" != "null" ]; then
  printf '  📟 %sv%s%s' "$(cc_version_color)" "$cc_version" "$(rst)"
fi

if [ -n "$output_style" ] && [ "$output_style" != "null" ]; then
  printf '  🎨 %s%s%s' "$(style_color)" "$output_style" "$(rst)"
fi

# Line 2: Context and session time
line2=""
if [ -n "$context_pct" ]; then
  context_bar=$(progress_bar "$context_remaining_pct" 10)
  line2="🧠 $(context_color)Context: ${context_pct} [${context_bar}]$(rst)"
fi

if [ -n "$session_txt" ]; then
  if [ -n "$line2" ]; then
    line2="$line2  ⌛ $(session_color)${session_txt}$(rst) [${session_bar}]"
  else
    line2="⌛ $(session_color)${session_txt}$(rst) [${session_bar}]"
  fi
fi

if [ -z "$line2" ] && [ -z "$context_pct" ]; then
  line2="🧠 $(context_color)Context: TBD$(rst)"
fi

# Line 3: Cost and usage analytics
line3=""
if [ -n "$cost_usd" ] && [[ "$cost_usd" =~ ^[0-9.]+$ ]]; then
  cost_formatted=$(printf '%.2f' "$cost_usd")
  if [ -n "$cost_per_hour" ] && [[ "$cost_per_hour" =~ ^[0-9.]+$ ]]; then
    cph_formatted=$(printf '%.2f' "$cost_per_hour")
    line3="💰 $(cost_color)\$${cost_formatted}$(rst) ($(burn_color)\$${cph_formatted}/h$(rst))"
  else
    line3="💰 $(cost_color)\$${cost_formatted}$(rst)"
  fi
fi

if [ -n "$tot_tokens" ] && [[ "$tot_tokens" =~ ^[0-9]+$ ]]; then
  tok_str="📊 $(usage_color)${tot_tokens} tok"
  if [ -n "$tpm" ] && [[ "$tpm" =~ ^[0-9.]+$ ]]; then
    tpm_formatted=$(printf '%.0f' "$tpm")
    tok_str="${tok_str} (${tpm_formatted} tpm)"
  fi
  tok_str="${tok_str}$(rst)"

  if [ -n "$line3" ]; then
    line3="$line3  $tok_str"
  else
    line3="$tok_str"
  fi
fi

# Print lines
[ -n "$line2" ] && printf '\n%s' "$line2"
[ -n "$line3" ] && printf '\n%s' "$line3"
printf '\n'
