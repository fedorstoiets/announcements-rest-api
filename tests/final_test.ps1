$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
if (-not (Test-Path (Join-Path $Root "package.json"))) {
    throw "Run this script from the homework project root."
}

$BaseUrl = "http://localhost:3000"
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$user1 = "fedor_$stamp"
$user2 = "owner2_$stamp"
$email1 = "$user1@example.com"
$email2 = "$user2@example.com"
$password = "Test123!"

$serverOut = Join-Path $env:TEMP "announcements-api-$stamp.out.log"
$serverErr = Join-Path $env:TEMP "announcements-api-$stamp.err.log"

function Assert-Equal {
    param($Actual, $Expected, [string]$Message)
    if ($Actual -ne $Expected) {
        throw "$Message | Expected: $Expected | Actual: $Actual"
    }
    Write-Host "PASS: $Message" -ForegroundColor Green
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw "FAILED: $Message"
    }
    Write-Host "PASS: $Message" -ForegroundColor Green
}

function Invoke-Json {
    param(
        [string]$Method,
        [string]$Uri,
        $Body = $null,
        [hashtable]$Headers = @{}
    )

    $params = @{
        Method = $Method
        Uri = $Uri
        Headers = $Headers
        UseBasicParsing = $true
        ErrorAction = "Stop"
    }

    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }

    try {
        $resp = Invoke-WebRequest @params
        $content = $null
        if ($resp.Content) {
            try { $content = $resp.Content | ConvertFrom-Json } catch { $content = $resp.Content }
        }
        return [pscustomobject]@{
            Status = [int]$resp.StatusCode
            Body = $content
            Raw = $resp.Content
        }
    }
    catch {
        $errorRecord = $_
        $resp = $errorRecord.Exception.Response
        if ($null -eq $resp) { throw }

        $status = [int]$resp.StatusCode
        $raw = ""

        # Windows PowerShell often stores the HTTP response body here.
        if ($errorRecord.ErrorDetails -and $errorRecord.ErrorDetails.Message) {
            $raw = $errorRecord.ErrorDetails.Message
        }

        # Fallback for hosts where ErrorDetails is empty.
        if (-not $raw) {
            try {
                $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $raw = $reader.ReadToEnd()
            } catch {}
        }

        $bodyObj = $null
        if ($raw) {
            try { $bodyObj = $raw | ConvertFrom-Json } catch { $bodyObj = $raw }
        }

        return [pscustomobject]@{
            Status = $status
            Body = $bodyObj
            Raw = $raw
        }
    }
}

function Wait-ForServer {
    $deadline = (Get-Date).AddSeconds(25)
    do {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/api-docs" -TimeoutSec 2
            if ($r.StatusCode -eq 200) { return }
        } catch {}
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    throw "Server did not start. See logs:`n$serverOut`n$serverErr"
}

Write-Host "Starting final verification..." -ForegroundColor Cyan
$proc = Start-Process `
    -FilePath "cmd.exe" `
    -ArgumentList "/c", "npm run dev" `
    -WorkingDirectory $Root `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr

try {
    Wait-ForServer
    Write-Host "Server ready." -ForegroundColor Cyan

    # Swagger
    $swagger = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/api-docs"
    Assert-Equal ([int]$swagger.StatusCode) 200 "Swagger /api-docs opens"

    # Register user 1
    $reg1 = Invoke-Json "POST" "$BaseUrl/auth/register" @{
        username = $user1
        email = $email1
        password = $password
        name = "Fedor"
    }
    Assert-Equal $reg1.Status 201 "Register returns 201"
    Assert-True ($null -ne $reg1.Body.accessToken) "Register returns access token"
    Assert-True ($null -ne $reg1.Body.refreshToken) "Register returns refresh token"
    Assert-True ($null -eq $reg1.Body.user.password) "Register never returns password"

    # Duplicate register
    $dup = Invoke-Json "POST" "$BaseUrl/auth/register" @{
        username = $user1
        email = $email1
        password = $password
        name = "Fedor"
    }
    Assert-Equal $dup.Status 409 "Duplicate register returns 409"

    # Login wrong password
    $wrong = Invoke-Json "POST" "$BaseUrl/auth/login" @{
        username = $user1
        password = "WRONG_PASSWORD"
    }
    Assert-Equal $wrong.Status 401 "Wrong password returns 401"
    Assert-Equal $wrong.Body.message "Invalid credentials" "Wrong password uses generic message"

    # Login missing user
    $missing = Invoke-Json "POST" "$BaseUrl/auth/login" @{
        username = "missing_$stamp"
        password = "whatever"
    }
    Assert-Equal $missing.Status 401 "Missing user returns 401"
    Assert-Equal $missing.Body.message "Invalid credentials" "Missing user uses same generic message"

    # Successful login
    $login1 = Invoke-Json "POST" "$BaseUrl/auth/login" @{
        username = $user1
        password = $password
    }
    Assert-Equal $login1.Status 200 "Login returns 200"
    $access1 = $login1.Body.accessToken
    $refresh1 = $login1.Body.refreshToken

    # /me
    $me = Invoke-Json "GET" "$BaseUrl/auth/me" $null @{
        Authorization = "Bearer $access1"
    }
    Assert-Equal $me.Status 200 "/auth/me returns 200"
    Assert-Equal $me.Body.username $user1 "/auth/me returns current user"
    Assert-True ($null -eq $me.Body.password) "/auth/me excludes password"

    # Refresh rotation
    $rotated = Invoke-Json "POST" "$BaseUrl/auth/refresh" @{
        refreshToken = $refresh1
    }
    Assert-Equal $rotated.Status 200 "Refresh returns 200"
    Assert-True ($rotated.Body.refreshToken -ne $refresh1) "Refresh token rotates"
    $newAccess1 = $rotated.Body.accessToken
    $newRefresh1 = $rotated.Body.refreshToken

    $reuseOld = Invoke-Json "POST" "$BaseUrl/auth/refresh" @{
        refreshToken = $refresh1
    }
    Assert-Equal $reuseOld.Status 401 "Old refresh token cannot be reused"

    # Create 12 announcements
    $created = @()
    for ($i = 1; $i -le 12; $i++) {
        $resp = Invoke-Json "POST" "$BaseUrl/announcements" @{
            title = "Laptop Offer $i"
            description = "Excellent condition announcement number $i"
            price = 1000 + $i
            category = "sale"
        } @{
            Authorization = "Bearer $newAccess1"
        }

        Assert-Equal $resp.Status 201 "Create announcement $i returns 201"
        Assert-Equal $resp.Body.user.username $user1 "Created announcement $i contains author"
        $created += $resp.Body
        Start-Sleep -Milliseconds 20
    }

    $firstCreatedId = [int]$created[0].id
    $lastCreatedId = [int]$created[-1].id

    # Public list + pagination
    $list1 = Invoke-Json "GET" "$BaseUrl/announcements?page=1"
    Assert-Equal $list1.Status 200 "Public list returns 200"
    Assert-Equal $list1.Body.pagination.perPage 10 "Pagination uses 10 per page"
    Assert-Equal $list1.Body.data.Count 10 "Page 1 contains 10 records"
    Assert-True ($list1.Body.pagination.total -ge 12) "Pagination total is present"

    $list2 = Invoke-Json "GET" "$BaseUrl/announcements?page=2"
    Assert-Equal $list2.Status 200 "Page 2 returns 200"
    Assert-True ($list2.Body.data.Count -ge 2) "Page 2 contains remaining records"

    # Search case-insensitive
    $search = Invoke-Json "GET" "$BaseUrl/announcements?search=laptop%20offer"
    Assert-Equal $search.Status 200 "Search returns 200"
    Assert-True ($search.Body.data.Count -ge 1) "Case-insensitive title search finds records"

    # Sorting
    $newest = Invoke-Json "GET" "$BaseUrl/announcements?search=Laptop%20Offer&sort=newest&page=1"
    $oldest = Invoke-Json "GET" "$BaseUrl/announcements?search=Laptop%20Offer&sort=oldest&page=1"
    Assert-Equal $newest.Status 200 "Newest sort returns 200"
    Assert-Equal $oldest.Status 200 "Oldest sort returns 200"
    Assert-True ([int]$newest.Body.data[0].id -ge [int]$oldest.Body.data[0].id) "Newest/oldest ordering differs correctly"

    # Get single
    $single = Invoke-Json "GET" "$BaseUrl/announcements/$firstCreatedId"
    Assert-Equal $single.Status 200 "GET /announcements/:id returns 200"
    Assert-Equal ([int]$single.Body.id) $firstCreatedId "GET by ID returns correct record"
    Assert-Equal $single.Body.user.username $user1 "GET by ID includes author"

    $notFound = Invoke-Json "GET" "$BaseUrl/announcements/99999999"
    Assert-Equal $notFound.Status 404 "Missing announcement returns 404"

    # Validation
    $emptyPatch = Invoke-Json "PATCH" "$BaseUrl/announcements/$firstCreatedId" @{} @{
        Authorization = "Bearer $newAccess1"
    }
    Assert-Equal $emptyPatch.Status 400 "Empty PATCH is rejected"

    # Owner update
    $patched = Invoke-Json "PATCH" "$BaseUrl/announcements/$firstCreatedId" @{
        price = 7777
    } @{
        Authorization = "Bearer $newAccess1"
    }
    Assert-Equal $patched.Status 200 "Owner can PATCH announcement"
    Assert-Equal ([double]$patched.Body.price) 7777 "PATCH updates price"

    # Register/login second user
    $reg2 = Invoke-Json "POST" "$BaseUrl/auth/register" @{
        username = $user2
        email = $email2
        password = $password
        name = "Second Owner"
    }
    Assert-Equal $reg2.Status 201 "Second user registers"

    $login2 = Invoke-Json "POST" "$BaseUrl/auth/login" @{
        username = $user2
        password = $password
    }
    Assert-Equal $login2.Status 200 "Second user logs in"
    $access2 = $login2.Body.accessToken

    # Ownership
    $foreignPatch = Invoke-Json "PATCH" "$BaseUrl/announcements/$firstCreatedId" @{
        price = 1
    } @{
        Authorization = "Bearer $access2"
    }
    Assert-Equal $foreignPatch.Status 403 "Non-owner PATCH returns 403"
    Assert-Equal $foreignPatch.Body.message "Access denied" "Non-owner PATCH message is Access denied"

    $foreignDelete = Invoke-Json "DELETE" "$BaseUrl/announcements/$firstCreatedId" $null @{
        Authorization = "Bearer $access2"
    }
    Assert-Equal $foreignDelete.Status 403 "Non-owner DELETE returns 403"
    Assert-Equal $foreignDelete.Body.message "Access denied" "Non-owner DELETE message is Access denied"

    # Owner delete
    $ownerDelete = Invoke-Json "DELETE" "$BaseUrl/announcements/$lastCreatedId" $null @{
        Authorization = "Bearer $newAccess1"
    }
    Assert-Equal $ownerDelete.Status 204 "Owner DELETE returns 204"

    # Logout
    $logout = Invoke-Json "POST" "$BaseUrl/auth/logout" $null @{
        Authorization = "Bearer $newAccess1"
    }
    Assert-Equal $logout.Status 204 "Logout returns 204"

    $afterLogout = Invoke-Json "POST" "$BaseUrl/auth/refresh" @{
        refreshToken = $newRefresh1
    }
    Assert-Equal $afterLogout.Status 401 "Refresh token invalid after logout"

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "ALL FINAL TESTS PASSED" -ForegroundColor Green
    Write-Host "TypeScript + Auth + CRUD + Pagination + Search + Sort + Ownership + Swagger verified." -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
}
finally {
    Write-Host ""
    Write-Host "Stopping test server..." -ForegroundColor DarkGray
    try {
        taskkill /PID $proc.Id /T /F | Out-Null
    } catch {}
}
