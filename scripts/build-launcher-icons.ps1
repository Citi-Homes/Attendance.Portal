param([Parameter(Mandatory=$true)][string]$Source)
Add-Type -AssemblyName System.Drawing
$res = Join-Path $PSScriptRoot '../android/app/src/main/res'
$sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
try {
    foreach ($entry in @(@('mdpi',48,108),@('hdpi',72,162),@('xhdpi',96,216),@('xxhdpi',144,324),@('xxxhdpi',192,432))) {
        foreach ($name in @('ic_launcher','ic_launcher_round','ic_launcher_foreground')) {
            $size = if ($name -eq 'ic_launcher_foreground') { [int]$entry[2] } else { [int]$entry[1] }
            $bitmap = New-Object System.Drawing.Bitmap($size,$size)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.Clear([System.Drawing.Color]::Black)
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                # Adaptive masks crop the outer 18dp; inset the artwork to retain the monogram.
                $inset = if ($name -eq 'ic_launcher_foreground') { [int]($size * 0.18) } else { 0 }
                $graphics.DrawImage($sourceImage,$inset,$inset,$size-2*$inset,$size-2*$inset)
                $bitmap.Save((Join-Path $res ("mipmap-"+$entry[0]+"/"+$name+".png")),[System.Drawing.Imaging.ImageFormat]::Png)
            } finally { $graphics.Dispose(); $bitmap.Dispose() }
        }
    }
} finally { $sourceImage.Dispose() }
