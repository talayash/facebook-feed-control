$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../store-assets'))
$chromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$profileDirectory = Join-Path $PSScriptRoot '../dist/store-render-profile'
foreach ($item in @(@('01-screenshot',1280,800),@('02-screenshot',1280,800),@('03-screenshot',1280,800),@('small-promo-440x280',440,280),@('marquee-1400x560',1400,560))) {
  $name = $item[0]; $width = $item[1]; $height = $item[2]
  $sourceUrl = 'file:///' + (Join-Path $assetDirectory "$name.html").Replace('\','/')
  $rawPath = Join-Path $assetDirectory "$name-raw.png"
  # Extra window height accommodates Chrome's headless browser frame; crop canvas below.
  $windowHeight = $height + 120
  $arguments = @('--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--force-device-scale-factor=1','--hide-scrollbars','--virtual-time-budget=2000',"--user-data-dir=$profileDirectory","--screenshot=$rawPath","--window-size=$width,$windowHeight",$sourceUrl)
  $process = Start-Process -FilePath $chromePath -ArgumentList $arguments -WindowStyle Hidden -PassThru
  if (-not $process.WaitForExit(30000)) { throw "Chrome render timed out for $name" }
  if (-not (Test-Path -LiteralPath $rawPath)) { throw "Missing render: $name" }
  $source = [System.Drawing.Image]::FromFile($rawPath)
  $canvas = New-Object System.Drawing.Bitmap $width,$height,([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.DrawImage($source,(New-Object System.Drawing.Rectangle 0,0,$width,$height),0,0,$width,$height,([System.Drawing.GraphicsUnit]::Pixel))
  $outputPath = Join-Path $assetDirectory "$name.png"
  $canvas.Save($outputPath,[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $canvas.Dispose(); $source.Dispose()
  Write-Output "$name.png : $width x $height, RGB (no alpha)"
}
