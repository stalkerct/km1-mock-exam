# =====================================================================
# 重新编译「科目一模拟考试.exe」的一键脚本
# 用法：在 exe-build 目录下执行   pwsh -File build.ps1
# 前置：app\index.html 存在（重新生成题库后覆盖它，再跑本脚本）
# =====================================================================
$ErrorActionPreference = "Stop"
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$b = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $b "out\科目一模拟考试.exe"
$core = Join-Path $b "lib\Microsoft.Web.WebView2.Core.dll"
$wf   = Join-Path $b "lib\Microsoft.Web.WebView2.WinForms.dll"
$html = Join-Path $b "app\index.html"
$src  = Join-Path $b "native.cs"

if (!(Test-Path $html)) {
  Write-Host "[错误] 缺少 app\index.html，请先复制 科目一模拟考试.html 为 app\index.html"
  exit 1
}
if (!(Test-Path $core)) { Write-Host "[错误] 缺少 WebView2 SDK DLL（lib 目录）"; exit 1 }

$cscArgs = @(
  "/nologo", "/codepage:65001", "/target:winexe", "/out:$out",
  "/resource:$html,AppHtml",
  "/resource:$core,ResCore",
  "/resource:$wf,ResWinForms",
  "/r:$core", "/r:$wf",
  "/r:System.Windows.Forms.dll", "/r:System.Drawing.dll",
  $src
)
& $csc @cscArgs
if ($LASTEXITCODE -ne 0) { Write-Host "[失败] csc 编译出错"; exit $LASTEXITCODE }

Copy-Item (Join-Path $b "lib\WebView2Loader.dll") (Join-Path $b "out\") -Force
Write-Host "[成功] 编译完成 -> $out"
Write-Host "[提示] 分发时 exe 与 WebView2Loader.dll 必须同目录"