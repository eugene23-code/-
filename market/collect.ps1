# 귀띔 시장 데이터 수집 실행 스크립트 (Windows)
# PATH 의 python 이 Microsoft Store 스텁일 수 있어 venv 의 python 을 직접 사용한다.
#   .\collect.ps1                → 1회 수집
#   .\collect.ps1 --watch 60     → 60초마다 갱신
#   .\collect.ps1 --history 30   → 30 영업일 종가 포함
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv = Join-Path $here ".venv\Scripts\python.exe"
if (-not (Test-Path $venv)) {
  $base = Join-Path $env:LOCALAPPDATA "Programs\Python\Python314\python.exe"
  if (-not (Test-Path $base)) { $base = "python" }
  & $base -m venv (Join-Path $here ".venv")
  & $venv -m pip install --quiet -r (Join-Path $here "requirements.txt")
}
& $venv (Join-Path $here "collect.py") @args
