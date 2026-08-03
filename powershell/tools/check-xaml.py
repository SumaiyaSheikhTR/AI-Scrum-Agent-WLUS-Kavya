"""Static well-formedness check for the XAML embedded in UI.ps1.

PowerShell is unavailable on CI/Linux, so this substitutes interpolation
placeholders and parses each XAML document with an XML parser.
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

UI = Path(__file__).resolve().parent.parent / "UI.ps1"


def strip_interpolations(text: str) -> str:
    out = []
    i = 0
    while i < len(text):
        if text.startswith("$(", i):
            depth = 0
            j = i + 1
            while j < len(text):
                if text[j] == "(":
                    depth += 1
                elif text[j] == ")":
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            expr = text[i : j + 1]
            out.append("" if "Get-SharedResourceXaml" in expr else "1")
            i = j + 1
            continue
        if text[i] == "$":
            j = i + 1
            while j < len(text) and (text[j].isalnum() or text[j] == "_"):
                j += 1
            out.append("1")
            i = j
            continue
        out.append(text[i])
        i += 1
    return "".join(out)


def main() -> int:
    source = UI.read_text(encoding="utf-8")
    blocks = re.findall(r'@"\r?\n(.*?)\r?\n"@', source, re.S)
    resources = re.findall(r"@'\r?\n(.*?)\r?\n'@", source, re.S)

    if not blocks:
        print("No interpolated here-strings found in UI.ps1")
        return 1

    shared = resources[0] if resources else ""
    failures = 0

    for index, block in enumerate(blocks, start=1):
        xaml = strip_interpolations(block)
        if "<Window" in xaml and shared:
            xaml = xaml.replace("</Window>", shared + "\n</Window>", 1)
        try:
            ET.fromstring(xaml)
            print(f"XAML block {index}: well-formed")
        except ET.ParseError as error:
            failures += 1
            print(f"XAML block {index}: PARSE ERROR -> {error}")

    for index, block in enumerate(resources, start=1):
        try:
            ET.fromstring(
                '<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" '
                'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">' + block + "</Window>"
            )
            print(f"Resource block {index}: well-formed")
        except ET.ParseError as error:
            failures += 1
            print(f"Resource block {index}: PARSE ERROR -> {error}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
