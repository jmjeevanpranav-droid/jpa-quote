param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
})[0]

Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

Function AwaitAction($WinRtAction) {
    $netTask = $asTaskAction.Invoke($null, @($WinRtAction))
    $netTask.Wait(-1) | Out-Null
}

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfPageRenderOptions, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null

Function Convert-OcrResultToPage($ocrResult, [int]$pageNum) {
    $tokens = @()
    foreach ($line in $ocrResult.Lines) {
        foreach ($word in $line.Words) {
            $r = $word.BoundingRect
            $tokens += @{
                text = $word.Text
                bbox = @([double]$r.X, [double]$r.Y, [double]($r.X + $r.Width), [double]($r.Y + $r.Height))
                y_center = [double]($r.Y + ($r.Height / 2.0))
                height = [double]$r.Height
            }
        }
    }

    # Sort tokens top-to-bottom, then left-to-right
    $sorted = $tokens | Sort-Object -Property @{ Expression = { [Math]::Round($_.y_center / 14.0) } }, @{ Expression = { $_.bbox[0] } }

    # Group into visual horizontal rows
    $rows = @()
    $currRow = @()
    $lastY = -9999.0

    foreach ($t in $sorted) {
        if ($lastY -lt -1000.0 -or [Math]::Abs($t.y_center - $lastY) -le 16.0) {
            $currRow += $t
            if ($lastY -lt -1000.0) {
                $lastY = $t.y_center
            } else {
                $lastY = ($lastY * 0.7) + ($t.y_center * 0.3)
            }
        } else {
            if ($currRow.Count -gt 0) {
                $rows += ,($currRow | Sort-Object { $_.bbox[0] })
            }
            $currRow = @($t)
            $lastY = $t.y_center
        }
    }
    if ($currRow.Count -gt 0) {
        $rows += ,($currRow | Sort-Object { $_.bbox[0] })
    }

    $textRows = @()
    $plainLines = @()

    foreach ($rTokens in $rows) {
        $plain = ($rTokens | ForEach-Object { $_.text }) -join ' '
        $plainLines += $plain

        $pipeParts = @()
        $currCell = @()
        $prevRight = -1.0
        foreach ($tok in $rTokens) {
            $left = [double]$tok.bbox[0]
            if ($prevRight -ge 0 -and ($left - $prevRight) -gt 28.0) {
                if ($currCell.Count -gt 0) {
                    $pipeParts += ($currCell -join ' ')
                }
                $currCell = @($tok.text)
            } else {
                $currCell += $tok.text
            }
            $prevRight = [double]$tok.bbox[2]
        }
        if ($currCell.Count -gt 0) {
            $pipeParts += ($currCell -join ' ')
        }
        $pipeText = $pipeParts -join ' | '
        $textRows += @{
            text = $plain
            pipe_text = $pipeText
        }
    }

    return @{
        page_number = $pageNum
        text = ($plainLines -join "`n")
        text_rows = $textRows
        all_tokens = $tokens
    }
}

$resolvedPath = [System.IO.Path]::GetFullPath($FilePath)
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()

$ext = [System.IO.Path]::GetExtension($resolvedPath).ToLowerInvariant()
$pagesOut = @()

$fileStream = [System.IO.File]::OpenRead($resolvedPath)
$winRtStream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($fileStream)

if ($ext -eq '.pdf') {
    $pdfDoc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromStreamAsync($winRtStream)) ([Windows.Data.Pdf.PdfDocument])
    $pageCount = [Math]::Min([int]$pdfDoc.PageCount, 12)
    for ($i = 0; $i -lt $pageCount; $i++) {
        $page = $pdfDoc.GetPage([uint32]$i)
        $memStream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
        $renderOpts = New-Object Windows.Data.Pdf.PdfPageRenderOptions
        $renderOpts.DestinationWidth = [uint32]([Math]::Max(1800, [int]($page.Size.Width * 2.2)))
        AwaitAction ($page.RenderToStreamAsync($memStream, $renderOpts))
        $memStream.Seek(0)
        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($memStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $softBmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $ocrBmp = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert($softBmp, [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)
        $ocrRes = Await ($engine.RecognizeAsync($ocrBmp)) ([Windows.Media.Ocr.OcrResult])
        $pagesOut += (Convert-OcrResultToPage $ocrRes ($i + 1))
        $page.Dispose()
        $memStream.Dispose()
    }
} else {
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($winRtStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $softBmp = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $ocrBmp = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert($softBmp, [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied)
    $ocrRes = Await ($engine.RecognizeAsync($ocrBmp)) ([Windows.Media.Ocr.OcrResult])
    $pagesOut += (Convert-OcrResultToPage $ocrRes 1)
}
$winRtStream.Dispose()
$fileStream.Dispose()

$fullText = ($pagesOut | ForEach-Object { $_.text }) -join "`n"
$outObj = @{
    success = $true
    engine = 'JPA Native Vision OCR'
    text = $fullText
    pages = $pagesOut
}

$outObj | ConvertTo-Json -Depth 8 -Compress
