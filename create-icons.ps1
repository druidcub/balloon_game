Add-Type -AssemblyName System.Drawing
$iconRoot=Join-Path $PSScriptRoot 'assets\icons'
foreach($icon in @(@('icon-192.png',192),@('icon-512.png',512),@('icon-maskable-512.png',512),@('apple-touch-icon.png',180))){
  $size=[int]$icon[1]
  $bitmap=[Drawing.Bitmap]::new($size,$size)
  $graphics=[Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#121827'))
  $graphics.ScaleTransform($size/512.0,$size/512.0)
  $stringPen=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#80e5e0'),8)
  $points=[Drawing.PointF[]]@([Drawing.PointF]::new(255,379),[Drawing.PointF]::new(280,411),[Drawing.PointF]::new(228,435),[Drawing.PointF]::new(257,451))
  $graphics.DrawCurve($stringPen,$points)
  $outline=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#070e1c'))
  $graphics.FillEllipse($outline,124,76,264,296)
  $gradient=[Drawing.Drawing2D.LinearGradientBrush]::new([Drawing.Point]::new(150,90),[Drawing.Point]::new(350,350),[Drawing.ColorTranslator]::FromHtml('#ffadca'),[Drawing.ColorTranslator]::FromHtml('#e83d7c'))
  $graphics.FillEllipse($gradient,132,84,248,280)
  $knot=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#e83d7c'))
  $graphics.FillPolygon($knot,[Drawing.PointF[]]@([Drawing.PointF]::new(255,356),[Drawing.PointF]::new(235,385),[Drawing.PointF]::new(275,385)))
  $shine=[Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(200,255,245,248))
  $graphics.FillEllipse($shine,168,125,30,69)
  $bitmap.Save((Join-Path $iconRoot $icon[0]),[Drawing.Imaging.ImageFormat]::Png)
  $shine.Dispose();$knot.Dispose();$gradient.Dispose();$outline.Dispose();$stringPen.Dispose();$graphics.Dispose();$bitmap.Dispose()
}
