import Foundation
import Carbon

struct Favorite: Codable { let title: String; let text: String; let shortcut: String }
struct HardwareVariant: Codable { let types: [Int]; let layers: [String: [String: String]] }
struct KeyboardModel: Codable {
    let name: String
    let version: String
    let layers: [String: [String: String]]
    let variants: [HardwareVariant]
    let superscript: [String: String]
    let favorites: [Favorite]
    let legends: [String: String]
    var activeLayers: [String: [String: String]] {
        variants.first { $0.types.contains(Int(LMGetKbdType())) }?.layers ?? layers
    }
    var yoCode: Int { 50 }
    func output(_ code: Int, layer: String) -> String {
        if layer == "superscript" {
            return superscript[activeLayers["base"]?[String(code)] ?? ""] ?? ""
        }
        return activeLayers[layer]?[String(code)] ?? ""
    }
    static func load() throws -> KeyboardModel {
        guard let url = Bundle.main.url(forResource: "layout", withExtension: "json") else {
            throw NSError(domain: "SlavonicFloatingKeyboard", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Не найдена таблица раскладки"])
        }
        return try JSONDecoder().decode(Self.self, from: Data(contentsOf: url))
    }
}

enum InputAction: Equatable {
    case unicode(String)
    case key(UInt16)
    static func keycap(_ code: Int, layer: String, model: KeyboardModel) -> InputAction? {
        if code == 49 { return .unicode(" ") }
        if [51, 36, 48, 123, 124].contains(code) { return .key(UInt16(code)) }
        let text = model.output(code, layer: layer)
        return text.isEmpty ? nil : .unicode(text)
    }
    func preview(appendingTo text: String) -> String {
        switch self {
        case .unicode(let value): return text + value
        case .key(51):
            var scalars = Array(text.unicodeScalars)
            if !scalars.isEmpty { scalars.removeLast() }
            return String(String.UnicodeScalarView(scalars))
        case .key(36): return text + "\n"
        case .key(48): return text + "\t"
        default: return text
        }
    }
}

func printable(_ text: String) -> String {
    if text == " " { return "Пробел" }
    if text == "\u{00A0}" { return "Неразр." }
    if text == "\u{202F}" { return "Узкий пробел" }
    guard let first = text.unicodeScalars.first else { return "" }
    if CharacterSet.controlCharacters.contains(first) { return "" }
    return CharacterSet.nonBaseCharacters.contains(first) ? "◌" + text : text
}

func codepoints(_ text: String) -> String {
    text.unicodeScalars.map { String(format: "U+%04X", $0.value) }.joined(separator: " ")
}

func selfTest(_ model: KeyboardModel) -> Int {
    var count = 0
    func check(_ value: Bool, _ description: String) {
        if !value { fputs("FAIL: \(description)\n", stderr); exit(1) }
        count += 1
    }
    for layer in ["base", "shift", "option", "shiftOption"] {
        check(model.activeLayers[layer] != nil, "layer \(layer)")
        for (code, text) in model.activeLayers[layer] ?? [:] {
            check(Int(code) != nil, "numeric keycode")
            check(text.utf16.count < 32, "Unicode event size")
        }
    }
    check(model.output(3, layer: "base") == "а", "Russian A mapping")
    check(model.output(3, layer: "shift") == "А", "Shift A mapping")
    check(model.output(3, layer: "superscript") == "ⷶ", "superscript A mapping")
    check(model.output(50, layer: "option").isEmpty, "empty web Option key stays empty")
    check(model.output(18, layer: "base") == "́", "web 1 is oxia")
    check(model.output(18, layer: "shift") == "1", "web Shift 1 is digit")
    check(model.output(16, layer: "option") == "ᲂу", "web Option Y is multi-scalar ou")
    check(model.favorites.count == 6, "six common accents")
    check(model.favorites.contains { $0.text == "҆́" }, "iso Unicode sequence")
    check(InputAction.keycap(51, layer: "option", model: model) == .key(51), "Backspace stays physical")
    check(InputAction.keycap(36, layer: "superscript", model: model) == .key(36), "Return stays physical")
    let iso = "ѻ҆́"
    check(InputAction.unicode(iso).preview(appendingTo: "") == iso, "Unicode preserved")
    check(InputAction.key(51).preview(appendingTo: iso) == "ѻ҆", "dry run deletes one scalar")
    check(printable("҃") == "◌҃", "display-only dotted circle")
    check(printable("а") == "а", "ordinary letter")
    print("PASS: \(count) checks; no NSApplication, event posting, clipboard, or permission prompt.")
    return count
}
