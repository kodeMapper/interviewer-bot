# Smoke Check Script — AI Smart Interviewer
# Run from project root: .\scripts\smoke-check.ps1
# Verifies all services are reachable and healthy.

param(
    [switch]$IncludeProctoring
)

$ErrorActionPreference = "Continue"
$failed = 0
$passed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$ExpectedField
    )
    
    Write-Host -NoNewline "  [$Name] $Url ... "
    
    try {
        $response = Invoke-RestMethod -Uri $Url -TimeoutSec 5 -ErrorAction Stop
        
        if ($ExpectedField -and -not ($response.PSObject.Properties.Name -contains $ExpectedField)) {
            Write-Host "WARN (missing '$ExpectedField')" -ForegroundColor Yellow
            $script:passed++
            return
        }
        
        Write-Host "OK" -ForegroundColor Green
        $script:passed++
    }
    catch {
        Write-Host "FAIL ($($_.Exception.Message))" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Smart Interviewer — Smoke Check"     -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. ML Service
Write-Host "[ML Service — port 8000]" -ForegroundColor Yellow
Test-Endpoint -Name "Health"     -Url "http://localhost:8000/health"     -ExpectedField "status"
Test-Endpoint -Name "Model Info" -Url "http://localhost:8000/model-info" -ExpectedField "intent_predictor"

# 2. Express Server
Write-Host ""
Write-Host "[Express Server — port 5001]" -ForegroundColor Yellow
Test-Endpoint -Name "Health"          -Url "http://localhost:5001/health"            -ExpectedField "status"
Test-Endpoint -Name "Question Topics" -Url "http://localhost:5001/api/questions/topics" -ExpectedField "success"
Test-Endpoint -Name "Question Stats"  -Url "http://localhost:5001/api/questions/stats"  -ExpectedField "success"
Test-Endpoint -Name "Session Stats"   -Url "http://localhost:5001/api/session/stats/summary" -ExpectedField "success"

# 3. Client (Vite dev server)
Write-Host ""
Write-Host "[Client — port 3000]" -ForegroundColor Yellow
try {
    $clientResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -ErrorAction Stop
    if ($clientResponse.Content -match "AI Smart Interviewer") {
        Write-Host "  [HTML]  http://localhost:3000 ... OK" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  [HTML]  http://localhost:3000 ... OK (title not matched)" -ForegroundColor Yellow
        $passed++
    }
}
catch {
    Write-Host "  [HTML]  http://localhost:3000 ... FAIL ($($_.Exception.Message))" -ForegroundColor Red
    $failed++
}

# 4. Proctoring (optional)
if ($IncludeProctoring) {
    Write-Host ""
    Write-Host "[Proctoring Flask — port 5000]" -ForegroundColor Yellow
    Test-Endpoint -Name "Status" -Url "http://localhost:5000/status" -ExpectedField "looking_away"
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Results: $passed passed, $failed failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($failed -gt 0) {
    Write-Host "Some services are not reachable. See docs\RUN_GUIDE.md for setup instructions." -ForegroundColor Yellow
    exit 1
}
else {
    Write-Host "All services healthy!" -ForegroundColor Green
    exit 0
}
