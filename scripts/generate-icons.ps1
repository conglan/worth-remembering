# 统一生成"值"字图标：PWA 与 Tauri 共用同一张 1024 母版，保证三端字号比例一致。
# 用法：pwsh -NoProfile -File .\scripts\generate-icons.ps1
#       再执行 node node_modules\@tauri-apps\cli\tauri.js icon "$env:TEMP\wr-icon-1024.png"
Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..\public\images'
$green = [System.Drawing.ColorTranslator]::FromHtml('#284d3b')
$cream = [System.Drawing.ColorTranslator]::FromHtml('#f0eee7')

# 母版里"值"的占比：560 / 1024 ≈ 54.7%，PWA 与桌面版都从这张图派生
$MASTER_FONT = 560

function Draw-Value([int]$size, [int]$fontPx, [string]$out) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  # 满画布铺底：系统自己裁形状，既不会留白边，也不会出现双圆角
  $g.Clear($green)
  $font = New-Object System.Drawing.Font('Microsoft YaHei', [float]$fontPx, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $brush = New-Object System.Drawing.SolidBrush($cream)
  # 汉字基线偏上，矩形整体下移一点让它视觉居中
  $rect = New-Object System.Drawing.RectangleF([float]0, [float]($size * 0.02), [float]$size, [float]$size)
  $g.DrawString('值', $font, $brush, $rect, $fmt)
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $font.Dispose(); $brush.Dispose()
  Write-Output "draw   $out"
}

function Resize-From([string]$src, [string]$dst, [int]$size) {
  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($img, 0, 0, $size, $size)
  $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  Write-Output "resize $dst"
}

$master = Join-Path $env:TEMP 'wr-icon-1024.png'
Draw-Value 1024 $MASTER_FONT $master

# PWA 的 any 图标全部由母版等比缩放，和 Tauri 桌面版同一字号比例
Resize-From $master (Join-Path $root 'icon-512-v2.png') 512
Resize-From $master (Join-Path $root 'icon-192-v2.png') 192

# maskable：字缩到 50%，外接圆约 70.7%，稳在系统 80% 安全区内
Draw-Value 512 256 (Join-Path $root 'icon-maskable-512-v2.png')

Write-Output "master -> $master"