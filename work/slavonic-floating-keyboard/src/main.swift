import AppKit
import ApplicationServices
import CoreText
import Darwin

let integrated = CommandLine.arguments.contains("--events-stdio") || CommandLine.arguments.contains("--integrated")
let dryRun = CommandLine.arguments.contains("--dry-run")
let hostPID: pid_t? = integrated ? getppid() : nil
func emit(_ name: String, _ values: [String: Any] = [:]) {
    guard integrated else { return }
    var body = values; body["event"] = name
    if let data = try? JSONSerialization.data(withJSONObject: body, options: [.sortedKeys]),
       let line = String(data: data, encoding: .utf8) {
        print(line); fflush(stdout)
    }
}
let model: KeyboardModel
do { model = try KeyboardModel.load() }
catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
if CommandLine.arguments.contains("--self-test") { _ = selfTest(model); exit(0) }
if CommandLine.arguments.contains("--dump-layout") {
    if let data = try? JSONEncoder().encode(model), let json = String(data:data,encoding:.utf8) { print(json); exit(0) }
    exit(1)
}

let ink = NSColor(calibratedRed: 0.19, green: 0.18, blue: 0.16, alpha: 1)
let paper = NSColor(calibratedRed: 0.97, green: 0.96, blue: 0.93, alpha: 1)
let accent = NSColor(calibratedRed: 0.65, green: 0.20, blue: 0.15, alpha: 1)
func slavFont(_ size: CGFloat) -> NSFont { NSFont(name: "Ponomar", size: size) ?? NSFont.systemFont(ofSize: size) }
func label(_ value: String, size: CGFloat = 12, color: NSColor = ink) -> NSTextField {
    let view = NSTextField(labelWithString: value)
    view.font = NSFont.systemFont(ofSize: size); view.textColor = color
    view.lineBreakMode = .byTruncatingTail
    return view
}

final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

class InactiveButton: NSButton {
    override var acceptsFirstResponder: Bool { false }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

final class Keycap: InactiveButton {
    var glyph = ""
    var legend = ""
    var marked = false
    var systemGlyph = false
    override func draw(_ dirtyRect: NSRect) {
        let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 1, dy: 1), xRadius: 6, yRadius: 6)
        (isHighlighted ? NSColor(calibratedWhite: 0.88, alpha: 1) : NSColor.white.withAlphaComponent(isEnabled ? 0.82 : 0.25)).setFill()
        path.fill()
        (marked ? accent.withAlphaComponent(0.5) : ink.withAlphaComponent(0.15)).setStroke(); path.lineWidth = 1; path.stroke()
        let small: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 9), .foregroundColor: NSColor.secondaryLabelColor]
        (legend as NSString).draw(at: NSPoint(x: 6, y: bounds.height - 13), withAttributes: small)
        let font = systemGlyph || glyph.count > 5 ? NSFont.systemFont(ofSize: glyph.count > 5 ? 11 : 18) : slavFont(27)
        let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: isEnabled ? (marked ? accent : ink) : NSColor.tertiaryLabelColor]
        let size = (glyph as NSString).size(withAttributes: attrs)
        (glyph as NSString).draw(at: NSPoint(x: (bounds.width-size.width)/2, y: max(2, (bounds.height-size.height)/2-2)), withAttributes: attrs)
    }
}

final class KeyboardView: NSView {
    var inputLayer = "base" { didSet { update(); onLayerChange?(inputLayer) } }
    var onAction: ((InputAction) -> Void)?
    var onLayerChange: ((String) -> Void)?
    private var keys = [Int: Keycap]()
    private let model: KeyboardModel
    private let rows: [[(Int, CGFloat)]]
    private let special: [Int: String] = [51:"⌫",48:"⇥",36:"↵",49:"Пробел",56:"⇧",58:"⌥",123:"←",124:"→"]
    init(model: KeyboardModel) {
        self.model = model
        let top: [(Int, CGFloat)] = [(model.yoCode,1)] + [18,19,20,21,23,22,26,28,25,29,27,24].map { ($0,1) } + [(51,1.6)]
        let row2: [(Int, CGFloat)] = [12,13,14,15,17,16,32,34,31,35,33,30,42].map { ($0,1) }
        let row3: [(Int, CGFloat)] = [0,1,2,3,5,4,38,40,37,41,39].map { ($0,1) } + [(36,1.6)]
        let row4: [(Int, CGFloat)] = [(56,1.6)] + [6,7,8,9,11,45,46,43,47,44].map { ($0,1) } + [(58,1.6)]
        rows = [top,row2,row3,row4,[(49,14.6)]]
        super.init(frame: .zero)
        for row in rows { for (code, _) in row {
            let button = Keycap(); button.isBordered = false; button.tag = code
            button.target = self; button.action = #selector(press(_:)); button.setButtonType(.momentaryPushIn)
            button.refusesFirstResponder = true; keys[code] = button; addSubview(button)
        }}
        update()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layout() {
        super.layout()
        let gap: CGFloat = 4, units: CGFloat = 5
        let height = (bounds.height-gap*(units-1))/units
        for (index, row) in rows.enumerated() {
            let total = row.reduce(CGFloat.zero) { $0 + $1.1 }
            let width = (bounds.width-gap*CGFloat(row.count-1))/total
            var x: CGFloat = 0
            for (code, weight) in row {
                keys[code]?.frame = NSRect(x:x,y:bounds.height-CGFloat(index+1)*height-CGFloat(index)*gap,width:width*weight,height:height)
                x += width*weight + gap
            }
        }
    }
    func update() {
        for (code, button) in keys {
            let text = model.output(code, layer: inputLayer)
            let base = model.output(code, layer: "base")
            button.legend = special[code] ?? (code == 49 ? "" : (model.legends[String(code)] ?? ""))
            button.glyph = special[code] ?? printable(text)
            button.systemGlyph = special[code] != nil
            button.marked = ["option","shiftOption","superscript"].contains(inputLayer) && text != base && !text.isEmpty
            if code == 56 { button.marked = ["shift","shiftOption"].contains(inputLayer) }
            if code == 58 { button.marked = ["option","shiftOption"].contains(inputLayer) }
            button.isEnabled = special[code] != nil || !text.isEmpty
            let title = special[code] ?? printable(text)
            button.toolTip = "\(title) · \(codepoints(text))"
            button.setAccessibilityLabel(code == 56 ? "Переключить Shift" : code == 58 ? "Переключить Option" : title)
            button.needsDisplay = true
        }
    }
    @objc private func press(_ sender: NSButton) {
        if sender.tag == 56 {
            inputLayer = inputLayer == "shift" ? "base" : inputLayer == "shiftOption" ? "option" : inputLayer == "option" ? "shiftOption" : "shift"
            return
        }
        if sender.tag == 58 {
            inputLayer = inputLayer == "option" ? "base" : inputLayer == "shiftOption" ? "shift" : inputLayer == "shift" ? "shiftOption" : "option"
            return
        }
        if let action = InputAction.keycap(sender.tag, layer: inputLayer, model: model) {
            onAction?(action)
            // Match the embedded keyboard: Shift releases after a character, Option remains on.
            if special[sender.tag] == nil {
                if inputLayer == "shift" { inputLayer = "base" }
                else if inputLayer == "shiftOption" { inputLayer = "option" }
            }
        }
    }
}

enum InsertionError: Error { case permission, target, event }
enum SystemInput {
    static func send(_ action: InputAction, to target: NSRunningApplication) throws {
        guard AXIsProcessTrusted() else { throw InsertionError.permission }
        guard target.processIdentifier != ProcessInfo.processInfo.processIdentifier,
              target.processIdentifier != hostPID,
              target.bundleIdentifier != "ru.slavonic.reference",
              NSWorkspace.shared.frontmostApplication?.processIdentifier == target.processIdentifier,
              !target.isTerminated else { throw InsertionError.target }
        let code: UInt16
        switch action { case .unicode: code = 0; case .key(let value): code = value }
        // Private state avoids borrowing physically held modifiers from the user's keyboard.
        guard let source = CGEventSource(stateID: .privateState),
              let down = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true),
              let up = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false) else { throw InsertionError.event }
        down.flags = []; up.flags = []
        if case .unicode(let value) = action {
            let utf16 = Array(value.utf16)
            guard !utf16.isEmpty, utf16.count < 32 else { throw InsertionError.event }
            utf16.withUnsafeBufferPointer { buffer in
                down.keyboardSetUnicodeString(stringLength: buffer.count, unicodeString: buffer.baseAddress)
                up.keyboardSetUnicodeString(stringLength: buffer.count, unicodeString: buffer.baseAddress)
            }
        }
        // Pin both halves to the frontmost process selected at the click; do not retarget mid-pair.
        down.postToPid(target.processIdentifier); up.postToPid(target.processIdentifier)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    var panel: FloatingPanel!
    var root: NSView!
    var keyboard: KeyboardView!
    var targetLabel: NSTextField!
    var messageLabel: NSTextField!
    var permission: InactiveButton!
    var attach: InactiveButton!
    var layers: NSSegmentedControl!
    var favorites = [InactiveButton]()
    var timer: Timer?
    var preview = ""
    var didAttach = false
    let layerNames = ["base","shift","option","shiftOption","superscript"]
    let frameName = "SlavonicFloatingKeyboard-v1"

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let fontURL = Bundle.main.url(forResource: "Ponomar-Regular", withExtension: "otf") {
            CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)
        }
        panel = FloatingPanel(contentRect: NSRect(x:0,y:0,width:940,height:415),
            styleMask:[.titled,.closable,.resizable,.utilityWindow,.nonactivatingPanel],backing:.buffered,defer:false)
        panel.title = "Церковнославянская клавиатура"
        panel.minSize = NSSize(width:760,height:385); panel.maxSize = NSSize(width:1600,height:760)
        panel.backgroundColor = paper; panel.appearance = NSAppearance(named:.aqua)
        panel.level = .floating; panel.hidesOnDeactivate = false; panel.isFloatingPanel = true
        panel.becomesKeyOnlyIfNeeded = true; panel.worksWhenModal = true; panel.isReleasedWhenClosed = false
        panel.collectionBehavior = [.canJoinAllSpaces,.fullScreenAuxiliary]
        panel.delegate = self
        root = NSView(frame:panel.contentView!.bounds); root.autoresizingMask = [.width,.height]; panel.contentView = root
        targetLabel = label(""); targetLabel.font = NSFont.systemFont(ofSize:12,weight:.medium)
        targetLabel.setAccessibilityIdentifier("target-status")
        permission = InactiveButton(title:"Разрешить ввод",target:self,action:#selector(requestPermission))
        permission.bezelStyle = .rounded; permission.refusesFirstResponder = true
        attach = InactiveButton(title:"Вернуть в программу",target:self,action:#selector(returnToProgram))
        attach.bezelStyle = .rounded; attach.refusesFirstResponder = true; attach.isHidden = !integrated
        layers = NSSegmentedControl(labels:["Буквы","⇧","⌥","⌥ ⇧","Надстрочные"],trackingMode:.selectOne,target:self,action:#selector(changeLayer))
        layers.selectedSegment = 0; layers.refusesFirstResponder = true
        layers.setAccessibilityLabel("Слой клавиатуры")
        keyboard = KeyboardView(model:model)
        keyboard.onAction = { [weak self] action in self?.insert(action) }
        keyboard.onLayerChange = { [weak self] name in
            if let index = self?.layerNames.firstIndex(of:name) { self?.layers.selectedSegment = index }
        }
        messageLabel = label(dryRun ? "Проверка интерфейса: ввод остаётся в этой строке." : "Нажмите в текст Word или другого приложения, затем выбирайте знаки здесь.",size:11,color:.secondaryLabelColor)
        messageLabel.setAccessibilityIdentifier("input-status")
        for (index, favorite) in model.favorites.enumerated() {
            let button = InactiveButton(title:"\(printable(favorite.text))  \(favorite.title)",target:self,action:#selector(insertFavorite(_:)))
            button.font = slavFont(19); button.tag = index; button.bezelStyle = .rounded; button.refusesFirstResponder = true
            button.toolTip = "\(favorite.title) · \(favorite.shortcut) · \(codepoints(favorite.text))"
            button.setAccessibilityLabel(favorite.title); favorites.append(button); root.addSubview(button)
        }
        for view in [targetLabel!,permission!,attach!,layers!,keyboard!,messageLabel!] { root.addSubview(view) }
        if !panel.setFrameUsingName(frameName) {
            if let visible = NSScreen.main?.visibleFrame { panel.setFrameOrigin(NSPoint(x:visible.midX-panel.frame.width/2,y:visible.minY+40)) }
        }
        constrainToScreen()
        panel.setFrameAutosaveName(frameName)
        layout(); refresh()
        panel.orderFrontRegardless()
        timer = Timer.scheduledTimer(withTimeInterval:0.6,repeats:true) { [weak self] _ in self?.refresh() }
        emit("ready",["dryRun":dryRun,"trusted":AXIsProcessTrusted(),"bundleID":Bundle.main.bundleIdentifier ?? ""])
    }
    func constrainToScreen() {
        let frame = panel.frame
        guard !NSScreen.screens.contains(where: { $0.visibleFrame.intersection(frame).width > 120 && $0.visibleFrame.intersection(frame).height > 80 }),
              let visible = NSScreen.main?.visibleFrame else { return }
        panel.setFrameOrigin(NSPoint(x:visible.midX-frame.width/2,y:visible.minY+40))
    }
    func layout() {
        guard root != nil else { return }
        let w = root.bounds.width, h = root.bounds.height, margin: CGFloat = 14
        let attachWidth: CGFloat = integrated ? 170 : 0
        targetLabel.frame = NSRect(x:margin,y:h-35,width:w-30-attachWidth-150,height:22)
        permission.frame = NSRect(x:w-margin-attachWidth-144,y:h-39,width:140,height:28)
        attach.frame = NSRect(x:w-margin-166,y:h-39,width:166,height:28)
        layers.frame = NSRect(x:margin,y:h-76,width:w-margin*2,height:28)
        keyboard.frame = NSRect(x:margin,y:87,width:w-margin*2,height:h-171)
        let fw = (w-margin*2-5*5)/6
        for (i,button) in favorites.enumerated() { button.frame = NSRect(x:margin+CGFloat(i)*(fw+5),y:46,width:fw,height:33) }
        messageLabel.frame = NSRect(x:margin,y:10,width:w-margin*2,height:28)
    }
    func windowDidResize(_ notification: Notification) { layout() }
    func refresh() {
        let app = NSWorkspace.shared.frontmostApplication
        let name = app?.processIdentifier == ProcessInfo.processInfo.processIdentifier || app?.processIdentifier == hostPID || app?.bundleIdentifier == "ru.slavonic.reference" ? nil : app?.localizedName
        targetLabel.stringValue = dryRun ? "Проверка интерфейса · без отправки в приложения" : (name.map { "Ввод: \($0)" } ?? "Поставьте курсор в другом приложении")
        permission.isHidden = dryRun || AXIsProcessTrusted()
        if let index = layerNames.firstIndex(of:keyboard.inputLayer), layers.selectedSegment != index { layers.selectedSegment = index }
    }
    func selectLayer(_ name: String) {
        keyboard.inputLayer = name
        if let index = layerNames.firstIndex(of:name) { layers.selectedSegment = index }
        messageLabel.stringValue = name == "superscript" ? "Выберите надстрочную букву. Для обычного набора нажмите «Буквы»." : (dryRun ? "Проверка интерфейса: текст не отправляется в приложения." : "В Word выберите шрифт Ponomar для церковнославянских знаков.")
    }
    @objc func changeLayer() { selectLayer(layerNames[layers.selectedSegment]) }
    @objc func insertFavorite(_ sender: NSButton) { insert(.unicode(model.favorites[sender.tag].text)) }
    func insert(_ action: InputAction) {
        if dryRun {
            preview = String(action.preview(appendingTo:preview).suffix(100))
            messageLabel.font = slavFont(24); messageLabel.textColor = ink
            messageLabel.stringValue = preview.isEmpty ? "Пустая пробная строка" : preview.replacingOccurrences(of:"\n",with:" ↵ ").replacingOccurrences(of:"\t",with:" ⇥ ")
            emit("preview",["text":preview]); return
        }
        guard let target = NSWorkspace.shared.frontmostApplication else { messageLabel.stringValue = "Поставьте курсор в текст другого приложения."; return }
        do {
            try SystemInput.send(action,to:target)
            messageLabel.stringValue = "Ввод в \(target.localizedName ?? "приложение") · в документе выберите шрифт Ponomar."
        } catch InsertionError.permission {
            messageLabel.stringValue = "Нажмите «Разрешить ввод» и включите приложение из системного запроса в «Универсальном доступе»."
        } catch InsertionError.target {
            messageLabel.stringValue = "Поставьте курсор в текст другого приложения и повторите нажатие."
        } catch { messageLabel.stringValue = "Не удалось отправить знак. Повторите нажатие." }
        refresh()
    }
    @objc func requestPermission() {
        _ = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String:true] as CFDictionary)
        if let url = URL(string:"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") { NSWorkspace.shared.open(url) }
        messageLabel.stringValue = "Разрешите приложение из системного запроса в «Универсальном доступе», затем вернитесь к документу."
    }
    @objc func returnToProgram() {
        guard !didAttach else { return }; didAttach = true
        emit("attach"); NSApp.terminate(nil)
    }
    func windowWillClose(_ notification: Notification) {
        if integrated { returnToProgram() } else { NSApp.terminate(nil) }
    }
    func applicationWillTerminate(_ notification: Notification) { timer?.invalidate(); emit("closed") }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

signal(SIGPIPE, SIG_IGN)
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate(); app.delegate = delegate
app.run()
