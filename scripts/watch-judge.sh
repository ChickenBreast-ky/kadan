#!/bin/bash
# Why: 감시AI가 watch-report로 직접 기록·보고한다. stdout은 판정에 쓰지 않는다.
set -euo pipefail
umask 077
judge_dir=${KADAN_JUDGE_DIR:?감시sh가 만든 호출 폴더가 필요합니다}
judge_home=${KADAN_HOME:-${KADAN_LITE_HOME:?카단 데이터 폴더(KADAN_HOME)가 필요합니다}}
judge_model=${KADAN_JUDGE_MODEL:?감시AI 모델을 KADAN_JUDGE_MODEL로 지정해야 합니다 (기본값 없음)}
printf 'KADAN_JUDGE_LOG_DIR=%s\nKADAN_JUDGE_MODEL=%s\n' "$judge_dir" "$judge_model" >&2
cat >"$judge_dir/input.txt"
printf '%s\n' "$judge_model" >"$judge_dir/model.txt"
judge_status=0
# 보고 명령의 원장 쓰기·로컬 tmux 통신을 허용한다. 제품 작업 폴더는 쓰기 범위에 넣지 않는다.
codex -a never exec --model "$judge_model" -c 'model_reasoning_effort="max"' -c project_doc_max_bytes=0 -c sandbox_workspace_write.network_access=true -C "$judge_dir" --sandbox workspace-write --add-dir "$judge_home" --skip-git-repo-check -o "$judge_dir/result.txt" <"$judge_dir/input.txt" >"$judge_dir/diagnostic.log" 2>&1 &
judge_pid=$!
trap 'kill -TERM "$judge_pid" 2>/dev/null || true; exit 143' TERM INT
wait "$judge_pid" || judge_status=$?
printf '%s\n' "$judge_status" >"$judge_dir/exit-code.txt"
if [[ -f "$judge_dir/result.txt" ]]; then cat "$judge_dir/result.txt"; fi
# 결과와 진단은 임시 증거로 보존한다. 자동 삭제하지 않는다.
exit "$judge_status"
