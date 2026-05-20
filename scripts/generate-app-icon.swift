#!/usr/bin/env swift
import AppKit
import Foundation

let canvasSize = Int(CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "128") ?? 128
let darkBlue = NSColor(red: 0.04, green: 0.18, blue: 0.45, alpha: 1.0) // #0A2E73
let outputPath = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon-128.png"

let size = NSSize(width: canvasSize, height: canvasSize)
guard
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: canvasSize,
        pixelsHigh: canvasSize,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )
else {
    fputs("Failed to create bitmap\n", stderr)
    exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

darkBlue.setFill()
NSBezierPath(rect: NSRect(origin: .zero, size: size)).fill()

let text = "AuraSafe" as NSString
let targetWidth = size.width * 0.94

var fontSize: CGFloat = 4
var font = NSFont.systemFont(ofSize: fontSize, weight: .bold)
var textSize = text.size(withAttributes: [.font: font])

while textSize.width < targetWidth, fontSize < 400 {
    fontSize += 0.25
    font = NSFont.systemFont(ofSize: fontSize, weight: .bold)
    textSize = text.size(withAttributes: [.font: font])
}

if textSize.width > targetWidth, fontSize > 4 {
    fontSize -= 0.25
    font = NSFont.systemFont(ofSize: fontSize, weight: .bold)
    textSize = text.size(withAttributes: [.font: font])
}

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
let attrs: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph,
]
let textRect = NSRect(
    x: (size.width - textSize.width) / 2,
    y: (size.height - textSize.height) / 2,
    width: textSize.width,
    height: textSize.height
)
text.draw(in: textRect, withAttributes: attrs)

NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else {
    fputs("Failed to encode PNG\n", stderr)
    exit(1)
}

let url = URL(fileURLWithPath: outputPath)
try png.write(to: url)
print("Wrote \(outputPath) (\(canvasSize)×\(canvasSize), font \(String(format: "%.1f", fontSize))pt, text \(Int(textSize.width))px wide)")
