# Shrinks the listing photos posted before the egress fix and uploads them through the one-off
# "shrink-old-photos" Edge Function: a 1280 px copy replaces each original, plus a 480 px "-t.jpg"
# copy for lists, both cached for a year. Back the originals up first (download-photos.ps1).
# Usage: powershell -ExecutionPolicy Bypass -File shrink-old-photos.ps1 -Photos <folder with listing-photos\...> -Key <SHRINK_KEY>
param([Parameter(Mandatory)][string]$Photos, [Parameter(Mandatory)][string]$Key, [switch]$DryRun)
Add-Type -AssemblyName System.Drawing
$fn = "https://rwxuygrbulskexgejbhm.supabase.co/functions/v1/shrink-old-photos"
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

function Shrink([string]$src, [int]$max, [long]$quality) {
  $img = [System.Drawing.Image]::FromFile($src)
  try {
    # Phones store photos sideways plus an "orientation" tag; turn the pixels the right way up
    if ($img.PropertyIdList -contains 0x0112) {
      $flip = @{ 2 = 'RotateNoneFlipX'; 3 = 'Rotate180FlipNone'; 4 = 'Rotate180FlipX'; 5 = 'Rotate90FlipX'; 6 = 'Rotate90FlipNone'; 7 = 'Rotate270FlipX'; 8 = 'Rotate270FlipNone' }[[int]$img.GetPropertyItem(0x0112).Value[0]]
      if ($flip) { $img.RotateFlip([System.Drawing.RotateFlipType]$flip) }
    }
    $s = [Math]::Min(1.0, $max / [Math]::Max($img.Width, $img.Height))
    $w = [int][Math]::Round($img.Width * $s); $h = [int][Math]::Round($img.Height * $s)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose()
    $p = New-Object System.Drawing.Imaging.EncoderParameters 1
    $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), $quality
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, $jpeg, $p); $bmp.Dispose()
    return ,$ms.ToArray()
  } finally { $img.Dispose() }
}

$root = (Resolve-Path (Join-Path $Photos 'listing-photos')).Path
$before = 0; $after = 0; $n = 0; $failed = 0
Get-ChildItem $root -Recurse -File | Where-Object { $_.Name -notmatch '-t\.jpg$' } | ForEach-Object {
  $name = $_.FullName.Substring($root.Length + 1) -replace '\\', '/'
  try {
    $full = Shrink $_.FullName 1280 80
    $thumb = Shrink $_.FullName 480 75
    $before += $_.Length; $after += $full.Length; $n++
    Write-Host ("{0}: {1:N0} KB -> {2:N0} KB, list copy {3:N0} KB" -f $name, ($_.Length / 1KB), ($full.Length / 1KB), ($thumb.Length / 1KB))
    if (-not $DryRun) {
      foreach ($k in @(@('full', $full), @('thumb', $thumb))) {
        Invoke-WebRequest -Method Post -Uri "$fn`?name=$([uri]::EscapeDataString($name))&kind=$($k[0])" -Headers @{ 'x-shrink-key' = $Key } -ContentType 'image/jpeg' -Body $k[1] -UseBasicParsing | Out-Null
      }
    }
  } catch { Write-Host "FAILED $name : $($_.Exception.Message)"; $failed++ }
}
Write-Host ("{0} photos: {1:N1} MB -> {2:N1} MB, {3} failed{4}" -f $n, ($before / 1MB), ($after / 1MB), $failed, $(if ($DryRun) { ' (dry run, nothing uploaded)' } else { '' }))
