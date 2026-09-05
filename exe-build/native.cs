// =====================================================================
// 科目一模拟考试 — 原生桌面宿主（WinForms + WebView2，纯 csc 编译）
// 说明：
//   1. 内嵌网页 app\index.html（含完整题库 base64 图片）
//   2. 内嵌托管 WebView2 DLL（Core/WinForms），运行时 AssemblyResolve 加载
//   3. 原生 WebView2Loader.dll 需与 exe 同目录（DllImport 按应用目录解析）
//   4. 用虚拟主机映射 https://km1.local/ 承载页面（非 file://，localStorage 可靠）
// 编译（PowerShell，UTF-8 源码）：
//   csc /nologo /codepage:65001 /target:winexe /out:out\科目一模拟考试.exe ...
// =====================================================================
using System;
using System.IO;
using System.Reflection;
using System.Text;
using System.Drawing;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Km1Exam
{
    internal static class Program
    {
        public const string AppName = "科目一模拟考试";
        public const string HostDomain = "km1.local";

        public static string DataDir;
        public static string AppDir;
        public static string LogPath;

        [STAThread]
        private static int Main(string[] args)
        {
            // 关键：必须先挂 AssemblyResolve，之后首次 new WebView2() 时才找得到托管 DLL
            AppDomain.CurrentDomain.AssemblyResolve += OnAssemblyResolve;

            string baseDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Km1Exam");
            AppDir = Path.Combine(baseDir, "app");
            DataDir = Path.Combine(baseDir, "webview-data");
            LogPath = Path.Combine(baseDir, "app.log");

            try
            {
                Directory.CreateDirectory(AppDir);
                Directory.CreateDirectory(DataDir);
            }
            catch (Exception ex) { Log("mkdir fail: " + ex.Message); }

            ExtractHtml();

            if (args != null)
            {
                foreach (string a in args)
                {
                    if (a == null) continue;
                    string al = a.ToLowerInvariant();
                    if (al == "--extract") return ExtractTo(Environment.CurrentDirectory);
                    if (al == "--selftest") return SelfTest();
                }
            }

            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainForm());
                return 0;
            }
            catch (Exception ex)
            {
                Log("FATAL: " + ex);
                MessageBox.Show("程序启动失败：\n" + ex.Message, AppName,
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }

        // ---------- 内嵌托管 DLL 的按需加载 ----------
        private static Assembly OnAssemblyResolve(object sender, ResolveEventArgs e)
        {
            string[] asm = { "Microsoft.Web.WebView2.Core", "Microsoft.Web.WebView2.WinForms" };
            string[] res = { "ResCore", "ResWinForms" };
            for (int i = 0; i < asm.Length; i++)
            {
                if (e.Name.StartsWith(asm[i] + ","))
                {
                    byte[] b = GetResource(res[i]);
                    if (b != null)
                    {
                        Log("AssemblyResolve loaded " + res[i] + " (" + b.Length + " bytes)");
                        return Assembly.Load(b);
                    }
                }
            }
            return null;
        }

        // ---------- 读取内嵌资源（按短名匹配，兼容带命名空间前缀） ----------
        private static byte[] GetResource(string name)
        {
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                string[] all = asm.GetManifestResourceNames();
                foreach (string n in all)
                {
                    string shortName = n;
                    int dot = n.LastIndexOf('.');
                    if (dot >= 0) shortName = n.Substring(dot + 1);
                    if (shortName == name)
                    {
                        using (Stream s = asm.GetManifestResourceStream(n))
                        {
                            byte[] buf = new byte[s.Length];
                            int off = 0, read;
                            while (off < buf.Length &&
                                   (read = s.Read(buf, off, buf.Length - off)) > 0)
                                off += read;
                            return buf;
                        }
                    }
                }
            }
            catch (Exception ex) { Log("GetResource(" + name + ") fail: " + ex.Message); }
            return null;
        }

        // ---------- 解压内嵌网页到数据目录（大小不变则跳过） ----------
        private static void ExtractHtml()
        {
            byte[] bytes = GetResource("AppHtml");
            if (bytes == null) { Log("FATAL: 内嵌 AppHtml 缺失"); return; }
            string target = Path.Combine(AppDir, "index.html");
            try
            {
                bool need = true;
                if (File.Exists(target))
                {
                    FileInfo fi = new FileInfo(target);
                    if (fi.Length == bytes.Length) need = false;
                }
                if (need) File.WriteAllBytes(target, bytes);
                Log("html ready -> " + target + " (" + bytes.Length + " bytes, rewrite=" + need + ")");
            }
            catch (Exception ex) { Log("ExtractHtml fail: " + ex.Message); }
        }

        // ---------- --extract : 把网页写到指定目录（无损、无窗口） ----------
        private static int ExtractTo(string dir)
        {
            byte[] bytes = GetResource("AppHtml");
            if (bytes == null)
            {
                Console.WriteLine("FATAL: no embedded AppHtml");
                return 1;
            }
            string p = Path.Combine(dir, "index.html");
            try { File.WriteAllBytes(p, bytes); }
            catch (Exception ex) { Console.WriteLine("write fail: " + ex.Message); return 1; }
            Console.WriteLine("written: " + p + " (" + bytes.Length + " bytes)");
            return 0;
        }

        // ---------- --selftest : 校验内嵌资源 / Runtime / 数据目录（无窗口） ----------
        private static int SelfTest()
        {
            Log("== selftest begin ==");
            int ok = 0;

            string[] resName = { "ResCore", "ResWinForms", "AppHtml" };
            foreach (string n in resName)
            {
                byte[] b = GetResource(n);
                bool good = b != null;
                if (good) ok++;
                Log((good ? "OK   " : "MISS ") + "embedded " + n +
                    (b != null ? " (" + b.Length + " bytes)" : ""));
            }

            try
            {
                string ver = CoreWebView2Environment.GetAvailableBrowserVersionString();
                Log("OK   WebView2 Runtime " + ver);
                ok++;
            }
            catch (Exception ex) { Log("MISS WebView2 Runtime: " + ex.Message); }

            try
            {
                Directory.CreateDirectory(DataDir);
                string probe = Path.Combine(DataDir, ".write-probe");
                File.WriteAllText(probe, "ok");
                Log("OK   data dir writable");
                ok++;
            }
            catch (Exception ex) { Log("MISS data dir: " + ex.Message); }

            Log("== selftest done: " + ok + "/5 ok ==");
            return ok >= 5 ? 0 : 1;
        }

        // ---------- 日志 ----------
        public static void Log(string msg)
        {
            try
            {
                File.AppendAllText(LogPath,
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + msg + Environment.NewLine,
                    Encoding.UTF8);
            }
            catch { }
        }
    }

    internal sealed class MainForm : Form
    {
        private WebView2 web;

        public MainForm()
        {
            Text = Program.AppName;
            Width = 1220;
            Height = 850;
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(900, 620);

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            Controls.Add(web);

            Load += OnLoad;
            FormClosed += OnClosed;
        }

        private async void OnLoad(object sender, EventArgs e)
        {
            try
            {
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(
                    null, Program.DataDir, null);
                await web.EnsureCoreWebView2Async(env);

                web.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    Program.HostDomain, Program.AppDir,
                    CoreWebView2HostResourceAccessKind.DenyCors);

                web.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
                web.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
                web.CoreWebView2.NewWindowRequested += OnNewWindowRequested;

                string url = "https://" + Program.HostDomain + "/index.html";
                Program.Log("navigate -> " + url);
                web.CoreWebView2.Navigate(url);
            }
            catch (Exception ex)
            {
                Program.Log("InitAsync error: " + ex);
                MessageBox.Show("初始化失败：\n" + ex.Message, Program.AppName,
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (!e.IsSuccess)
            {
                Program.Log("nav failed: " + e.WebErrorStatus);
                return;
            }
            Program.Log("nav ok");
            try
            {
                // 注入页面 JS 错误上报，便于定位「脚本没加载 / 脚本报错」
                web.CoreWebView2.ExecuteScriptAsync(
                    "window.addEventListener('error', function(e){" +
                    "if(window.chrome && window.chrome.webview){" +
                    "window.chrome.webview.postMessage('JSERR ' + e.message + ' @' + (e.filename||'') + ':' + e.lineno);" +
                    "}});");
            }
            catch { }
        }

        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try { Program.Log("page: " + e.TryGetWebMessageAsString()); }
            catch (Exception ex) { Program.Log("page msg parse fail: " + ex.Message); }
        }

        private void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true; // 单文件应用不外链，拦截一切新窗口
            Program.Log("new window blocked: " + e.Uri);
        }

        private void OnClosed(object sender, FormClosedEventArgs e)
        {
            Program.Log("window closed");
            try { if (web != null) web.Dispose(); } catch { }
        }
    }
}