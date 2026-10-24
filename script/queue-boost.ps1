# Sequential queue: waits for the dictionary sweep to finish, then runs
# Phase-5 basins and the Phase-6 collision matrix in order. Writes
# logs/queue-status.json stage heartbeats for script/status.mjs.
$ErrorActionPreference = 'Continue'
Set-Location 'C:\src\github.com\nater0000\open-universe'

$stages = @('gentle', 'tension', 'collide-matrix')
$sweepPid = [int](Get-Content 'logs/sweep.pid').Trim()
function ts([string]$m) { "[$(Get-Date -Format 'HH:mm:ss')] $m" }
function qstat([string]$stage, [int]$idx) {
  @{ ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();
     stage = $stage; idx = $idx; total = $stages.Count; stages = $stages } |
    ConvertTo-Json -Compress | Set-Content 'logs/queue-status.json'
}

ts "queue: waiting for sweep PID $sweepPid"
while (Get-Process -Id $sweepPid -ErrorAction SilentlyContinue) {
  qstat 'waiting-sweep' 0
  Wait-Process -Id $sweepPid -Timeout 60 -ErrorAction SilentlyContinue
}
ts "queue: sweep finished - launching gentle basin"
qstat 'gentle' 1

node script/boost.mjs --config=config/boost-gentle.json *> logs\boost-gentle.log
ts "queue: gentle done (exit $LASTEXITCODE) - launching tension basin"
qstat 'tension' 2

node script/boost.mjs --config=config/boost-tension.json *> logs\boost-tension.log
ts "queue: tension done (exit $LASTEXITCODE) - launching collision matrix"
qstat 'collide-matrix' 3

node script/collide.mjs --config=config/collide-matrix.json *> logs\collide.log
ts "queue: collide done (exit $LASTEXITCODE) - queue complete"
qstat 'complete' $stages.Count
