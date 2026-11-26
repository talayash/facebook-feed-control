# Draw the feed mark at high resolution, then downsample for Chrome.
Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../extension/icons'
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
$canvas = New-Object System.Drawing.Bitmap 512,512
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)
$shape = New-Object System.Drawing.Drawing2D.GraphicsPath
$shape.AddArc(0,0,160,160,180,90)
$shape.AddArc(352,0,160,160,270,90)
$shape.AddArc(352,352,160,160,0,90)
$shape.AddArc(0,352,160,160,90,90)
$shape.CloseFigure()
$background = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#294C3B'))
$graphics.FillPath($background,$shape)
$line = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#F3F5E9')),34
$line.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$line.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($line,120,156,376,156)
$graphics.DrawLine($line,120,248,300,248)
$graphics.DrawLine($line,120,340,224,340)
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#DDBA72'))
$graphics.FillEllipse($accent,328,304,72,72)
foreach ($size in @(16,32,48,128)) {
  $icon = New-Object System.Drawing.Bitmap $size,$size
  $scaled = [System.Drawing.Graphics]::FromImage($icon)
  $scaled.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scaled.DrawImage($canvas,0,0,$size,$size)
  $icon.Save((Join-Path $iconDirectory "icon-$size.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  $scaled.Dispose()
  $icon.Dispose()
}
$line.Dispose(); $accent.Dispose(); $background.Dispose(); $shape.Dispose(); $graphics.Dispose(); $canvas.Dispose()
