Add-Type -AssemblyName System.Drawing

$src = "D:\allprograms\科目一模拟\research\km1-full-extracted\word\media"
$dst = "D:\allprograms\科目一模拟\research\img-compressed"
New-Item -ItemType Directory -Force -Path $dst | Out-Null

$maxDim = 360       # 最长边
$pngThreshold = 8KB # PNG 小于阈值直接用 PNG，否则转 JPEG
$jpegQuality = 75

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }

function Get-JpegBytes([System.Drawing.Bitmap]$bmp, [int]$quality) {
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, $jpegCodec, $ep)
    return $ms.ToArray()
}

$stats = @{ total = 0; ok = 0; skip = 0; fail = 0; inBytes = 0; outBytes = 0 }

Get-ChildItem $src -File | ForEach-Object {
    $stats.total++
    $stats.inBytes += $_.Length
    $outFile = Join-Path $dst $_.BaseName
    try {
        $img = [System.Drawing.Image]::FromFile($_.FullName)
        $w = $img.Width; $h = $img.Height
        $scale = 1.0
        if ($w -gt $maxDim -or $h -gt $maxDim) {
            $scale = [Math]::Min($maxDim / $w, $maxDim / $h)
        }
        $nw = [Math]::Max(1, [int]($w * $scale)); $nh = [Math]::Max(1, [int]($h * $scale))

        $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($img, 0, 0, $nw, $nh)
        $g.Dispose()

        # PNG 编码
        $msPng = New-Object System.IO.MemoryStream
        $bmp.Save($msPng, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $msPng.ToArray()
        $msPng.Dispose()

        if ($pngBytes.Length -le $pngThreshold) {
            [System.IO.File]::WriteAllBytes($outFile + ".png", $pngBytes)
        } else {
            # 白底 JPEG（透明PNG兼容）
            $jb = Get-JpegBytes $bmp $jpegQuality
            if ($jb.Length -lt $pngBytes.Length) {
                [System.IO.File]::WriteAllBytes($outFile + ".jpg", $jb)
            } else {
                [System.IO.File]::WriteAllBytes($outFile + ".png", $pngBytes)
            }
        }
        $bmp.Dispose()
        $img.Dispose()
        $stats.ok++
        $final = Get-ChildItem "$outFile.*" | Select-Object -First 1
        $stats.outBytes += $final.Length
    } catch {
        $stats.fail++
        # 失败则原样拷贝
        Copy-Item $_.FullName (Join-Path $dst $_.Name) -Force
        $stats.outBytes += $_.Length
    }
}

"处理: $($stats.total) 成功: $($stats.ok) 失败: $($stats.fail)"
"原始: {0:N2} MB -> 压缩后: {1:N2} MB (压缩率 {2:P0})" -f ($stats.inBytes/1MB), ($stats.outBytes/1MB), (1 - $stats.outBytes/$stats.inBytes)
