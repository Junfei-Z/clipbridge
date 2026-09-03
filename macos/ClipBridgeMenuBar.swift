import AppKit
import Foundation

private struct Health: Decodable {
    let ok: Bool
    let instanceId: String?
    let urls: [String]?
}

final class ClipBridgeApp: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var serverProcess: Process?
    private var readinessTimer: Timer?
    private var startedAt = Date()
    private var panelURL = URL(string: "http://127.0.0.1:39393/ui")!
    private var deviceURL: URL?
    private let instanceId = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        if NSRunningApplication.runningApplications(withBundleIdentifier: Bundle.main.bundleIdentifier ?? "")
            .contains(where: { $0.processIdentifier != ProcessInfo.processInfo.processIdentifier }) {
            let port = readPort(from: projectRoot.appendingPathComponent(".clipbridge/config.json"))
            panelURL = URL(string: "http://127.0.0.1:\(port)/ui")!
            NSWorkspace.shared.open(panelURL)
            NSApp.terminate(nil)
            return
        }
        configureMenu()

        do {
            try startRelay()
        } catch {
            showFailure(error.localizedDescription)
        }
    }

    private var projectRoot: URL {
        if let override = ProcessInfo.processInfo.environment["CLIPBRIDGE_ROOT"], !override.isEmpty {
            return URL(fileURLWithPath: override, isDirectory: true)
        }
        let executable = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL
        return executable.deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
    }

    private func configureMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            let iconURL = Bundle.main.url(forResource: "brand-icon-96", withExtension: "png")
            if let iconURL, let image = NSImage(contentsOf: iconURL) {
                image.size = NSSize(width: 19, height: 19)
                image.isTemplate = false
                button.image = image
            } else {
                button.title = "🌉"
            }
            button.toolTip = "ClipBridge · Mac relay node"
        }

        let menu = NSMenu()
        menu.addItem(withTitle: "ClipBridge · Mac 中转节点", action: nil, keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "打开管理面板", action: #selector(openPanel), keyEquivalent: "o").target = self
        menu.addItem(withTitle: "复制设备网址", action: #selector(copyDeviceURL), keyEquivalent: "c").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "退出 ClipBridge", action: #selector(quit), keyEquivalent: "q").target = self
        statusItem.menu = menu
    }

    private func startRelay() throws {
        let root = projectRoot
        let server = root.appendingPathComponent("src/server.mjs")
        guard FileManager.default.fileExists(atPath: server.path) else {
            throw NSError(domain: "ClipBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "找不到 src/server.mjs。请从完整的 ClipBridge 文件夹启动。"])
        }

        let state = root.appendingPathComponent(".clipbridge", isDirectory: true)
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        let port = readPort(from: state.appendingPathComponent("config.json"))
        panelURL = URL(string: "http://127.0.0.1:\(port)/ui")!

        let process = Process()
        guard let nodePathURL = Bundle.main.url(forResource: "node-path", withExtension: nil),
              let nodePath = try? String(contentsOf: nodePathURL, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines),
              !nodePath.isEmpty else {
            throw NSError(domain: "ClipBridge", code: 2, userInfo: [NSLocalizedDescriptionKey: "找不到构建时记录的 Node.js 路径。请重新运行 Start-ClipBridge-Mac.command。"])
        }
        process.executableURL = URL(fileURLWithPath: nodePath)
        process.arguments = [server.path]
        process.currentDirectoryURL = root
        var environment = ProcessInfo.processInfo.environment
        environment["CLIPBRIDGE_LAUNCH_MODE"] = "menubar"
        environment["CLIPBRIDGE_INSTANCE_ID"] = instanceId
        process.environment = environment

        FileManager.default.createFile(atPath: state.appendingPathComponent("server.log").path, contents: nil)
        FileManager.default.createFile(atPath: state.appendingPathComponent("server-error.log").path, contents: nil)
        process.standardOutput = try FileHandle(forWritingTo: state.appendingPathComponent("server.log"))
        process.standardError = try FileHandle(forWritingTo: state.appendingPathComponent("server-error.log"))
        process.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self, self.readinessTimer != nil else { return }
                self.showFailure("中转服务意外退出（状态码 \(process.terminationStatus)）。请查看 .clipbridge/server-error.log。")
            }
        }

        try process.run()
        serverProcess = process
        startedAt = Date()
        readinessTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            self?.checkReadiness()
        }
    }

    private func readPort(from configURL: URL) -> Int {
        guard let data = try? Data(contentsOf: configURL),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let port = object["port"] as? Int else { return 39393 }
        return port
    }

    private func checkReadiness() {
        if Date().timeIntervalSince(startedAt) > 15 {
            readinessTimer?.invalidate()
            readinessTimer = nil
            showFailure("中转服务未能在 15 秒内启动。请查看 .clipbridge/server-error.log。")
            return
        }

        let healthURL = panelURL.deletingLastPathComponent().appendingPathComponent("health")
        URLSession.shared.dataTask(with: healthURL) { [weak self] data, _, _ in
            guard let self, let data,
                  let health = try? JSONDecoder().decode(Health.self, from: data),
                  health.ok, health.instanceId == self.instanceId else { return }
            DispatchQueue.main.async {
                self.readinessTimer?.invalidate()
                self.readinessTimer = nil
                self.deviceURL = health.urls?.compactMap(URL.init(string:)).first
                self.statusItem.button?.toolTip = "ClipBridge · Mac 中转节点已就绪"
                self.openPanel()
            }
        }.resume()
    }

    @objc private func openPanel() {
        NSWorkspace.shared.open(panelURL)
    }

    @objc private func copyDeviceURL() {
        let value = deviceURL ?? panelURL
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value.absoluteString, forType: .string)
    }

    private func showFailure(_ message: String) {
        readinessTimer?.invalidate()
        readinessTimer = nil
        let alert = NSAlert()
        alert.messageText = "ClipBridge 无法启动"
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.runModal()
        quit()
    }

    @objc private func quit() {
        readinessTimer?.invalidate()
        if let process = serverProcess, process.isRunning {
            process.terminate()
            process.waitUntilExit()
        }
        NSApp.terminate(nil)
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let process = serverProcess, process.isRunning { process.terminate() }
    }
}

let application = NSApplication.shared
let appDelegate = ClipBridgeApp()
application.delegate = appDelegate
application.run()
