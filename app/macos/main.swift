// Infofilm.app: a native window around the local Infofilm app (http://localhost:4747), with its
// own Dock icon. app/macos/make-app.sh compiles it on the Mac with the Xcode command line tools.
// Opening it starts the server (start.sh); ⌘Q stops it, after a warning if a job is running.
// Closing the window keeps the app in the Dock; a click on the icon brings the window back.
import Cocoa
import WebKit

let port = ProcessInfo.processInfo.environment["INFOFILM_PORT"] ?? "4747"
let home = URL(string: "http://localhost:\(port)/")!

/// The checkout this app was built from (make-app.sh writes it to Resources/appdir).
func appDir() -> String {
    if let p = Bundle.main.path(forResource: "appdir", ofType: nil),
       let s = try? String(contentsOfFile: p, encoding: .utf8) {
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return NSHomeDirectory() + "/infofilm/app"
}

func escapeHTML(_ s: String) -> String {
    return s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKUIDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var serverReady = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        let config = WKWebViewConfiguration()
        web = WKWebView(frame: .zero, configuration: config)
        web.uiDelegate = self
        web.navigationDelegate = self

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Infofilm"
        window.minSize = NSSize(width: 720, height: 520)
        window.contentView = web
        window.delegate = self
        window.isReleasedWhenClosed = false
        if !window.setFrameUsingName("InfofilmMain") { window.center() }
        window.setFrameAutosaveName("InfofilmMain")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        web.loadHTMLString(page(title: "Startar Infofilm …", detail: ""), baseURL: nil)
        startServer()
    }

    // ── the server ──

    func startServer() {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/bin/zsh")
        // a login shell, so Homebrew, nvm and ~/.local/bin are on PATH as in Terminal
        task.arguments = ["-lc", "'\(appDir())/start.sh' --no-open"]
        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = pipe
        task.terminationHandler = { t in
            let out = String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            DispatchQueue.main.async {
                if t.terminationStatus == 0 {
                    self.serverReady = true
                    self.web.load(URLRequest(url: home))
                } else {
                    self.web.loadHTMLString(self.page(title: "Infofilm kunde inte starta",
                                                      detail: out + "\n\nMer finns i ~/.infofilm/server.log och ~/.infofilm/launcher.log."), baseURL: nil)
                }
            }
        }
        do {
            try task.run()
        } catch {
            web.loadHTMLString(page(title: "Infofilm kunde inte starta", detail: "\(error)"), baseURL: nil)
        }
    }

    /// Titles of the jobs running in the app right now ("Rendera alla format (Budgeten)").
    final class Found { var titles: [String] = [] }

    func runningJobs() -> [String] {
        let found = Found()
        let sem = DispatchSemaphore(value: 0)
        var req = URLRequest(url: home.appendingPathComponent("api/projects"))
        req.timeoutInterval = 3
        URLSession.shared.dataTask(with: req) { data, _, _ in
            if let data = data, let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] {
                for p in list {
                    if let r = p["running"] as? [String: Any], let t = r["title"] as? String {
                        found.titles.append("\(t) (\(p["title"] as? String ?? ""))")
                    }
                }
            }
            sem.signal()
        }.resume()
        _ = sem.wait(timeout: .now() + 4)
        return found.titles
    }

    func stopServer() {
        var req = URLRequest(url: home.appendingPathComponent("api/quit"))
        req.httpMethod = "POST"
        req.setValue("1", forHTTPHeaderField: "X-Infofilm")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = "{}".data(using: .utf8)
        req.timeoutInterval = 2
        let sem = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: req) { _, _, _ in sem.signal() }.resume()
        _ = sem.wait(timeout: .now() + 3)
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard serverReady else { return .terminateNow }
        let running = runningJobs()
        if !running.isEmpty {
            let a = NSAlert()
            a.messageText = "Avsluta Infofilm?"
            a.informativeText = "Det här pågår och avbryts:\n" + running.joined(separator: "\n")
            a.addButton(withTitle: "Avsluta")
            a.addButton(withTitle: "Avbryt")
            if a.runModal() != .alertFirstButtonReturn { return .terminateCancel }
        }
        stopServer()
        return .terminateNow
    }

    // closing the window keeps the app (and its Dock icon); the icon brings the window back
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { return false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { window.makeKeyAndOrderFront(nil) }
        return true
    }

    // ── the page ──

    func page(title: String, detail: String) -> String {
        let retry = detail.isEmpty ? "" : "<p><a href=\"\(home.absoluteString)\">Försök igen</a></p>"
        return """
        <!doctype html><meta charset="utf-8"><style>
        :root{color-scheme:light dark}body{font:15px -apple-system,system-ui;margin:0;display:grid;place-items:center;height:100vh;background:Canvas;color:CanvasText}
        main{max-width:620px;padding:24px;text-align:center}pre{text-align:left;white-space:pre-wrap;font-size:12px;opacity:.8}
        .dot{width:10px;height:10px;border-radius:50%;background:#1e9bd7;display:inline-block;animation:p 1s infinite alternate}@keyframes p{to{opacity:.2}}
        </style><main><h2>\(escapeHTML(title))</h2>\(detail.isEmpty ? "<span class=dot></span>" : "<pre>\(escapeHTML(detail))</pre>")\(retry)</main>
        """
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        webView.loadHTMLString(page(title: "Infofilm svarar inte", detail: error.localizedDescription + "\n\nVälj Visa → Läs in igen (⌘R) för att starta om."), baseURL: nil)
        serverReady = false
    }

    // links away from the app open in the default browser
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, let scheme = url.scheme, scheme.hasPrefix("http"),
           url.host != "localhost" || url.port != Int(port) {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // window.open (Remotion Studio) → the default browser
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    // <input type="file"> ("Välj filer", logo, fonts): a WKWebView opens no file dialog unless the app does
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true
        panel.prompt = "Välj"
        panel.beginSheetModal(for: window) { r in completionHandler(r == .OK ? panel.urls : nil) }
    }

    // alert / confirm / prompt: a WKWebView shows nothing unless the app draws them
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.addButton(withTitle: "OK")
        a.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.addButton(withTitle: "OK")
        a.addButton(withTitle: "Avbryt")
        a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = NSAlert()
        a.messageText = prompt
        a.addButton(withTitle: "OK")
        a.addButton(withTitle: "Avbryt")
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24))
        field.stringValue = defaultText ?? ""
        a.accessoryView = field
        a.window.initialFirstResponder = field
        a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn ? field.stringValue : nil) }
    }

    // ── menus ──

    @objc func reloadPage(_ sender: Any?) {
        if serverReady { web.reload() } else { startServer() }
    }

    @objc func goHome(_ sender: Any?) { web.load(URLRequest(url: home)) }

    @objc func showMainWindow(_ sender: Any?) { window.makeKeyAndOrderFront(nil) }

    func buildMenu() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Om Infofilm", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Göm Infofilm", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Avsluta Infofilm", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem()
        main.addItem(editItem)
        let edit = NSMenu(title: "Redigera")
        edit.addItem(withTitle: "Ångra", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Gör om", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(NSMenuItem.separator())
        edit.addItem(withTitle: "Klipp ut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Kopiera", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Klistra in", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Markera allt", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit

        let viewItem = NSMenuItem()
        main.addItem(viewItem)
        let view = NSMenu(title: "Visa")
        view.addItem(withTitle: "Filmer", action: #selector(goHome(_:)), keyEquivalent: "1")
        view.addItem(withTitle: "Läs in igen", action: #selector(reloadPage(_:)), keyEquivalent: "r")
        viewItem.submenu = view

        let winItem = NSMenuItem()
        main.addItem(winItem)
        let win = NSMenu(title: "Fönster")
        win.addItem(withTitle: "Minimera", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        win.addItem(withTitle: "Stäng fönstret", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        win.addItem(NSMenuItem.separator())
        win.addItem(withTitle: "Infofilm", action: #selector(showMainWindow(_:)), keyEquivalent: "0")
        winItem.submenu = win

        NSApp.mainMenu = main
        NSApp.windowsMenu = win
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
