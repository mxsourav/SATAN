import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove the Show Footer toggle state
text = text.replace("const [showFooter, setShowFooter] = useState(true);", "")

# 2. Remove the Show Footer toggle UI block
text = re.sub(r'\{\/\* Show Footer Toggle \*\/\}[\s\S]*?<\/label>\s*<\/div>', '', text)

# 3. Replace {showFooter && ( <footer> ... </footer> )} with a standard <div>
text = text.replace("{showFooter && (", "")
text = text.replace("<footer className=\"mt-auto", "<div className=\"mt-auto")
text = text.replace("</footer>\n      )}\n    </div>", "</div>\n    </div>")
text = text.replace("</footer>", "</div>")

# 4. Add Mouse and Touch events to the buttons to absolutely guarantee they work everywhere!
def bind_button(btn_name, text_blob):
    target = f"onPointerCancel={{() => sendBtn('{btn_name}', false)}}"
    replacement = f"{target}\n                  onMouseDown={{() => sendBtn('{btn_name}', true)}}\n                  onMouseUp={{() => sendBtn('{btn_name}', false)}}\n                  onTouchStart={{() => sendBtn('{btn_name}', true)}}\n                  onTouchEnd={{() => sendBtn('{btn_name}', false)}}"
    return text_blob.replace(target, replacement)

for btn in ["UP", "DOWN", "LEFT", "RIGHT", "OK", "BACK"]:
    text = bind_button(btn, text)

# Also bind the top Macro buttons to Touch and Mouse just in case
text = text.replace("onClick={() => sendMacro('CMD_OPEN_IR_JAMMER')}", "onPointerDown={() => sendMacro('CMD_OPEN_IR_JAMMER')} onClick={() => sendMacro('CMD_OPEN_IR_JAMMER')}")
text = text.replace("onClick={() => sendMacro('CMD_OPEN_IR_RECEIVER')}", "onPointerDown={() => sendMacro('CMD_OPEN_IR_RECEIVER')} onClick={() => sendMacro('CMD_OPEN_IR_RECEIVER')}")
text = text.replace("onClick={() => sendMacro('CMD_OPEN_WIFI_SCAN')}", "onPointerDown={() => sendMacro('CMD_OPEN_WIFI_SCAN')} onClick={() => sendMacro('CMD_OPEN_WIFI_SCAN')}")

# Add touch events to reboot and clear log
text = text.replace("onClick={reboot}", "onPointerDown={reboot} onClick={reboot}")
text = text.replace("onClick={() => setTerminalLogs([])}", "onPointerDown={() => setTerminalLogs([])} onClick={() => setTerminalLogs([])}")


with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Patched successfully!')
